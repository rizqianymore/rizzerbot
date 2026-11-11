import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, "../../../tmp/media-cache");
const DB_PATH = path.resolve(__dirname, "../../../tmp/media-cache.db");

// Default retention 24 jam (dalam milidetik)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB batas total cache

let dbInstance = null;
let getStmt = null;
let setStmt = null;
let touchStmt = null;
let deleteStmt = null;
let purgeOldStmt = null;
let totalSizeStmt = null;
let oldestStmt = null;

function getDb() {
  if (dbInstance) return dbInstance;
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS media_cache (
        url_hash TEXT PRIMARY KEY,
        url TEXT,
        filename TEXT,
        mime TEXT,
        size INTEGER,
        info_json TEXT,
        created_at INTEGER,
        last_accessed INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_cache_accessed ON media_cache(last_accessed);
    `);

    getStmt = dbInstance.prepare("SELECT * FROM media_cache WHERE url_hash = ? LIMIT 1");
    setStmt = dbInstance.prepare(`
      INSERT OR REPLACE INTO media_cache (url_hash, url, filename, mime, size, info_json, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    touchStmt = dbInstance.prepare("UPDATE media_cache SET last_accessed = ? WHERE url_hash = ?");
    deleteStmt = dbInstance.prepare("DELETE FROM media_cache WHERE url_hash = ?");
    purgeOldStmt = dbInstance.prepare("SELECT * FROM media_cache WHERE last_accessed < ?");
    totalSizeStmt = dbInstance.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM media_cache");
    oldestStmt = dbInstance.prepare("SELECT * FROM media_cache ORDER BY last_accessed ASC LIMIT 10");

    return dbInstance;
  } catch (err) {
    console.warn("[MediaCache] Gagal inisialisasi database SQLite cache:", err.message);
    return null;
  }
}

export function hashUrl(url) {
  return crypto.createHash("sha256").update(String(url || "").trim()).digest("hex");
}

/**
 * Mengambil media ter-cache jika tersedia dan belum expired
 */
export async function getCachedMedia(url, ttlMs = DEFAULT_TTL_MS) {
  const db = getDb();
  if (!db || !getStmt) return null;

  const key = hashUrl(url);
  try {
    const row = getStmt.get(key);
    if (!row) return null;

    const now = Date.now();
    if (now - row.last_accessed > ttlMs) {
      await removeCacheEntry(row);
      return null;
    }

    const filePath = path.join(CACHE_DIR, row.filename);
    if (!fs.existsSync(filePath)) {
      deleteStmt.run(key);
      return null;
    }

    const buffer = await fsp.readFile(filePath);
    touchStmt.run(now, key);

    let info = null;
    try {
      if (row.info_json) info = JSON.parse(row.info_json);
    } catch (_) {}

    return {
      buffer,
      mime: row.mime,
      info,
      source: "smart-cache",
      cachedAt: row.created_at,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Menyimpan buffer media ke cache SQLite + file sistem
 */
export async function setCachedMedia(url, buffer, { mime = "video/mp4", info = null } = {}) {
  const db = getDb();
  if (!db || !setStmt || !buffer || !buffer.length) return false;

  // Jangan cache file di atas 80MB
  if (buffer.length > 80 * 1024 * 1024) return false;

  const key = hashUrl(url);
  const now = Date.now();
  const ext = mime.includes("image") ? (mime.includes("png") ? "png" : "jpg") : "mp4";
  const filename = `${key}.${ext}`;
  const filePath = path.join(CACHE_DIR, filename);

  try {
    // Periksa kuota kapasitas cache
    await enforceCacheLimit();

    await fsp.writeFile(filePath, buffer);
    const infoJson = info ? JSON.stringify(info) : null;

    setStmt.run(
      key,
      String(url).slice(0, 500),
      filename,
      mime,
      buffer.length,
      infoJson,
      now,
      now
    );
    return true;
  } catch (err) {
    console.warn("[MediaCache] Gagal menyimpan cache media:", err.message);
    return false;
  }
}

async function removeCacheEntry(row) {
  if (!row) return;
  try {
    const filePath = path.join(CACHE_DIR, row.filename);
    await fsp.unlink(filePath).catch(() => {});
    deleteStmt.run(row.url_hash);
  } catch (_) {}
}

async function enforceCacheLimit() {
  if (!totalSizeStmt || !oldestStmt) return;
  try {
    let current = totalSizeStmt.get()?.total || 0;
    while (current > MAX_CACHE_SIZE_BYTES) {
      const oldestRows = oldestStmt.all();
      if (!oldestRows || oldestRows.length === 0) break;
      for (const row of oldestRows) {
        await removeCacheEntry(row);
        current -= row.size || 0;
        if (current <= MAX_CACHE_SIZE_BYTES) break;
      }
    }
  } catch (_) {}
}

/**
 * Membersihkan cache usang yang melewati masa simpan
 */
export async function cleanupExpiredCache(ttlMs = DEFAULT_TTL_MS) {
  const db = getDb();
  if (!db || !purgeOldStmt) return 0;
  const cutoff = Date.now() - ttlMs;
  try {
    const expired = purgeOldStmt.all(cutoff);
    if (!expired || expired.length === 0) return 0;
    for (const row of expired) {
      await removeCacheEntry(row);
    }
    return expired.length;
  } catch (_) {
    return 0;
  }
}
