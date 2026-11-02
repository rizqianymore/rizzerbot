import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "../../../database/samsat.db");

let dbInstance = null;
let queryPlateStmt = null;
let queryNikStmt = null;

function getDatabase() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DB_PATH)) {
    return null;
  }
  try {
    const stat = fs.statSync(DB_PATH);
    if (!stat.isFile() || stat.size < 1024) {
      console.warn("[SamsatService] Database file too small/empty, treating as missing:", stat.size);
      return null;
    }
  } catch {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(DB_PATH, { readOnly: true });

    dbInstance.exec("PRAGMA query_only = 1;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");

    queryPlateStmt = dbInstance.prepare(`
      SELECT * FROM samsat WHERE number = ? LIMIT 1
    `);

    queryNikStmt = dbInstance.prepare(`
      SELECT * FROM samsat WHERE nik = ? LIMIT 10
    `);

    return dbInstance;
  } catch (err) {
    console.error("[SamsatService] Gagal membuka database:", err);
    return null;
  }
}

export function searchByPlate(rawPlate) {
  const db = getDatabase();
  if (!db || !queryPlateStmt) {
    throw new Error("Database SAMSAT belum diinisialisasi atau file database/samsat.db tidak ditemukan.");
  }

  const cleanPlate = String(rawPlate)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (!cleanPlate) return null;

  return queryPlateStmt.get(cleanPlate) || null;
}

export function searchByNik(rawNik) {
  const db = getDatabase();
  if (!db || !queryNikStmt) {
    throw new Error("Database SAMSAT belum diinisialisasi atau file database/samsat.db tidak ditemukan.");
  }

  const cleanNik = String(rawNik).trim();
  if (!cleanNik) return [];

  return queryNikStmt.all(cleanNik);
}

export function isSamsatReady() {
  try {
    if (!fs.existsSync(DB_PATH)) return false;
    const stat = fs.statSync(DB_PATH);
    return stat.isFile() && stat.size >= 1024;
  } catch {
    return false;
  }
}

export function getSamsatStatus() {
  try {
    if (!fs.existsSync(DB_PATH)) return { ready: false, reason: "file tidak ada" };
    const stat = fs.statSync(DB_PATH);
    if (stat.size < 1024) return { ready: false, reason: `file kosong (${stat.size} bytes) — fallback parse plat aktif` };
    const db = getDatabase();
    if (!db) return { ready: false, reason: "gagal membuka database" };
    return { ready: true, size: stat.size };
  } catch (e) {
    return { ready: false, reason: e.message };
  }
}
