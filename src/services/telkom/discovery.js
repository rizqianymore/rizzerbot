import fs from "fs";
import path from "path";
import { APP_ORIGIN, APP_ROOT, DEFAULT_BASES, DEFAULT_HASHES, PORTAL_URL, trimBase } from "./config.js";
import { telkomRequest } from "./http.js";

/**
 * Auto-discovery endpoint resmi Telkom Schools (DigitS).
 *
 * TUJUAN: tidak ada konfigurasi manual. Bot membaca sendiri:
 *   1. runtime config aplikasi resmi (window.__NUXT__.config.public)
 *      -> base URL API (presensi-read / presensi-write / read / issueauth)
 *   2. bundle JS halaman "/siswa/presensi"
 *      -> hash endpoint yang dipakai (32 hex)
 *   3. validasi hash dengan probe ringan (404 = salah, 401 = route ada)
 *
 * Hasil disimpan ke database/telkom/endpoints.json (TTL 24 jam) supaya
 * tidak mengunduh bundle setiap kali perintah dipakai.
 */

const CACHE_FILE = path.join(process.cwd(), "database", "telkom", "endpoints.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HASH_RE = /\b([0-9a-f]{32})\b/g;
const MAX_HASH_CANDIDATES = 8;

/**
 * Parse literal JavaScript object (subset) menjadi objek biasa.
 * Runtime config Nuxt ditulis sebagai object literal (`{public:{foo:"bar"}}`),
 * jadi JSON.parse tidak bisa dipakai langsung.
 */
export function parseJsObject(literal) {
  const text = String(literal || "");
  let pos = 0;

  const skipWs = () => {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  };

  const readString = () => {
    const quote = text[pos];
    pos++;
    let out = "";
    while (pos < text.length) {
      const ch = text[pos];
      if (ch === "\\") {
        const next = text[pos + 1];
        const map = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
        if (next === "u") {
          out += String.fromCharCode(parseInt(text.slice(pos + 2, pos + 6), 16) || 0);
          pos += 6;
          continue;
        }
        out += map[next] ?? next;
        pos += 2;
        continue;
      }
      if (ch === quote) {
        pos++;
        return out;
      }
      out += ch;
      pos++;
    }
    return out;
  };

  const readValue = () => {
    skipWs();
    const ch = text[pos];
    if (ch === "{") return readObject();
    if (ch === "[") return readArray();
    if (ch === '"' || ch === "'") return readString();
    const rest = text.slice(pos);
    const number = rest.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (number) {
      pos += number[0].length;
      return Number(number[0]);
    }
    const word = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    if (word) {
      pos += word[0].length;
      if (word[0] === "true") return true;
      if (word[0] === "false") return false;
      if (word[0] === "null") return null;
      if (word[0] === "undefined") return null;
      return word[0];
    }
    pos++;
    return null;
  };

  const readObject = () => {
    const out = {};
    pos++; // {
    skipWs();
    if (text[pos] === "}") {
      pos++;
      return out;
    }
    while (pos < text.length) {
      skipWs();
      if (text[pos] === "}") {
        pos++;
        break;
      }
      let key;
      if (text[pos] === '"' || text[pos] === "'") key = readString();
      else {
        const word = text.slice(pos).match(/^[A-Za-z0-9_$]+/);
        key = word ? word[0] : "";
        pos += key.length;
      }
      skipWs();
      if (text[pos] === ":") pos++;
      out[key] = readValue();
      skipWs();
      if (text[pos] === ",") pos++;
    }
    return out;
  };

  const readArray = () => {
    const out = [];
    pos++; // [
    skipWs();
    if (text[pos] === "]") {
      pos++;
      return out;
    }
    while (pos < text.length) {
      skipWs();
      if (text[pos] === "]") {
        pos++;
        break;
      }
      out.push(readValue());
      skipWs();
      if (text[pos] === ",") pos++;
    }
    return out;
  };

  skipWs();
  if (text[pos] !== "{") return {};
  return readObject();
}

/** Parse `window.__NUXT__.config={public:{...}}` dari HTML aplikasi resmi. */
export function parseNuxtConfig(html) {
  const text = String(html || "");
  const marker = "__NUXT__.config=";
  const at = text.indexOf(marker);
  if (at < 0) return {};
  const start = text.indexOf("{", at);
  if (start < 0) return {};
  let depth = 0;
  let inString = false;
  let quote = "";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === quote && text[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return parseJsObject(text.slice(start, i + 1));
      }
    }
  }
  return {};
}

/** Ambil daftar file bundle `_nuxt/*.js` dari HTML. */
export function extractChunkUrls(html) {
  const text = String(html || "");
  const urls = new Set();
  const patterns = [/src="(\/_nuxt\/[^"]+\.js)"/g, /href="(\/_nuxt\/[^"]+\.js)"/g];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) urls.add(match[1]);
  }
  return Array.from(urls);
}

/** Temukan nama file chunk rute (mis. "siswa-presensi") dari bundle utama. */
export function findRouteChunk(js, routeName) {
  const text = String(js || "");
  const at = text.indexOf(`"${routeName}"`);
  if (at < 0) return null;
  const window = text.slice(at, at + 600);
  const match = window.match(/import\("\.\/([A-Za-z0-9_.-]+\.js)"\)/);
  return match ? match[1] : null;
}

/** Kumpulkan kandidat hash endpoint (32 hex) dari sebuah bundle. */
export function extractHashes(js) {
  const out = new Set();
  for (const match of String(js || "").matchAll(HASH_RE)) out.add(match[1]);
  return Array.from(out).slice(0, MAX_HASH_CANDIDATES * 3);
}

/** Ambil nama file bundle yang di-import oleh sebuah bundle. */
export function extractImports(js) {
  const out = new Set();
  for (const match of String(js || "").matchAll(/from"\.\/([A-Za-z0-9_.-]+\.js)"/g)) {
    out.add(match[1]);
  }
  return Array.from(out);
}

/** Normalisasi base URL dari runtime config aplikasi. */
export function normalizeBases(config = {}) {
  const pub = config?.public || {};
  const bases = {};
  const map = {
    issueauth: pub.issueauth,
    registrasiRead: pub.registrasiRead,
    presensiRead: pub.presensiRead,
    presensiWrite: pub.presensiWrite,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value) bases[key] = trimBase(value);
  }
  return bases;
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeCache(payload) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (_) {}
}

function fallbackEndpoints() {
  return {
    bases: { ...DEFAULT_BASES },
    hashes: { ...DEFAULT_HASHES },
    discoveredAt: new Date().toISOString(),
    source: "fallback",
    validated: false,
  };
}

async function fetchText(url, { timeoutMs = 25000 } = {}) {
  const res = await telkomRequest(url, {
    method: "GET",
    timeoutMs,
    allowBrowser: true,
    allowThrow: false,
    extraHeaders: { Accept: "text/html,application/xhtml+xml,application/javascript,*/*" },
  });
  if (res.status >= 400 || typeof res.data !== "string") return "";
  return res.data;
}

/**
 * Probe hash untuk memastikan route benar-benar ada.
 * Route yang ada tapi butuh auth -> 401/403. Route salah -> 404.
 */
async function probeHash(kind, base, hash) {
  const routeExists = (status) => Number(status) !== 404 && Number(status) < 500;
  try {
    if (kind === "read") {
      const res = await telkomRequest(`${base}/${hash}/1`, {
        method: "GET",
        timeoutMs: 15000,
        allowBrowser: false,
        allowThrow: false,
      });
      return routeExists(res.status);
    }
    if (kind === "write") {
      const res = await telkomRequest(`${base}/${hash}`, {
        method: "POST",
        timeoutMs: 15000,
        allowBrowser: false,
        allowThrow: false,
        contentType: "application/json",
        body: {},
      });
      return routeExists(res.status);
    }
    const res = await telkomRequest(`${base}/${hash}`, {
      method: "GET",
      timeoutMs: 15000,
      allowBrowser: false,
      allowThrow: false,
    });
    return routeExists(res.status);
  } catch (_) {
    return false;
  }
}

async function validateHashes(bases, hashes) {
  const result = { ...hashes };
  const jobs = [
    ["read", bases.presensiRead, "read"],
    ["write", bases.presensiWrite, "write"],
    ["profile", bases.registrasiRead, "profile"],
  ];
  for (const [key, base, kind] of jobs) {
    if (!base || !result[key]) continue;
    const ok = await probeHash(kind, base, result[key]);
    if (!ok) delete result[key];
  }
  return result;
}

/** Cari hash student presensi dari bundle halaman "/siswa/presensi". */
async function discoverHashes(bases, chunks, logger) {
  const hashes = {};
  const candidates = [];

  for (const chunk of chunks.slice(0, 12)) {
    const js = await fetchText(`${APP_ORIGIN}${chunk}`, { timeoutMs: 30000 });
    if (!js) continue;

    // 1) route chunk halaman siswa
    const routeChunk = findRouteChunk(js, "siswa-presensi");
    if (routeChunk) {
      const routeJs = await fetchText(`${APP_ORIGIN}/_nuxt/${routeChunk}`, {
        timeoutMs: 30000,
      });
      if (routeJs) {
        candidates.push(...extractHashes(routeJs));
        // Modul turunan (mis. fetch profil siswa) menyimpan hash endpoint profil.
        for (const dep of extractImports(routeJs).slice(0, 8)) {
          const depJs = await fetchText(`${APP_ORIGIN}/_nuxt/${dep}`, { timeoutMs: 30000 });
          if (depJs) candidates.push(...extractHashes(depJs));
        }
      }
    }

    // 2) fallback: bundle yang memuat penanda halaman siswa
    if (js.includes("QR Datang")) candidates.push(...extractHashes(js));
  }

  const unique = Array.from(new Set(candidates));
  if (!unique.length) {
    logger?.warn?.("[Telkom] discovery: tidak ada kandidat hash di bundle");
    return hashes;
  }

  // Klasifikasikan tiap kandidat lewat probe ringan.
  for (const hash of unique.slice(0, MAX_HASH_CANDIDATES)) {
    if (hashes.read && hashes.write && hashes.profile) break;
    if (!hashes.read && bases.presensiRead && (await probeHash("read", bases.presensiRead, hash))) {
      hashes.read = hash;
      continue;
    }
    if (!hashes.write && bases.presensiWrite && (await probeHash("write", bases.presensiWrite, hash))) {
      hashes.write = hash;
      continue;
    }
    if (!hashes.profile && bases.registrasiRead && (await probeHash("profile", bases.registrasiRead, hash))) {
      hashes.profile = hash;
    }
  }

  return hashes;
}

/**
 * Ambil konfigurasi endpoint terbaru (auto).
 * @param {{force?: boolean, logger?: object}} options
 */
export async function discoverEndpoints({ force = false, logger } = {}) {
  const cached = readCache();
  if (!force && cached?.discoveredAt) {
    const age = Date.now() - new Date(cached.discoveredAt).getTime();
    if (Number.isFinite(age) && age < CACHE_TTL_MS && cached.bases && cached.hashes) {
      return { ...cached, source: cached.source || "cache" };
    }
  }

  try {
    const appHtml = await fetchText(APP_ROOT, { timeoutMs: 30000 });
    const portalHtml = appHtml ? "" : await fetchText(PORTAL_URL, { timeoutMs: 30000 });

    const bases = {
      ...DEFAULT_BASES,
      ...normalizeBases(parseNuxtConfig(appHtml)),
      ...normalizeBases(parseNuxtConfig(portalHtml)),
    };

    const chunks = extractChunkUrls(appHtml);
    const found = await discoverHashes(bases, chunks, logger);

    const hashes = { ...DEFAULT_HASHES, ...found };
    const validated = await validateHashes(bases, hashes);
    const merged = { ...hashes, ...validated };

    const payload = {
      bases,
      hashes: merged,
      discoveredAt: new Date().toISOString(),
      source: "discovery",
      validated: Object.keys(validated).length > 0,
    };
    writeCache(payload);
    return payload;
  } catch (err) {
    logger?.warn?.(`[Telkom] discovery gagal, pakai default: ${err?.message || err}`);
    const payload = fallbackEndpoints();
    writeCache(payload);
    return payload;
  }
}

let resolved = null;
let resolving = null;
let refreshTried = false;

function complete(result) {
  resolved = result;
  return result;
}

/** Endpoint aktif (dengan cache in-memory), selalu tersedia. */
export async function resolveEndpoints({ logger, force = false } = {}) {
  if (resolved && !force) {
    // Hash hilang (mis. server sekolah mengganti endpoint) -> paksa discovery ulang sekali.
    if (!refreshTried && resolved.hashes && !resolved.hashes.read) {
      refreshTried = true;
      try {
        return await resolveEndpoints({ logger, force: true });
      } catch (_) {}
    }
    return resolved;
  }
  if (resolving && !force) return resolving;
  resolving = discoverEndpoints({ logger, force })
    .then((result) => complete(result))
    .finally(() => {
      resolving = null;
    });
  return resolving;
}

/** Bersihkan cache in-memory (untuk testing/admin). */
export function resetEndpointCache() {
  resolved = null;
  resolving = null;
  refreshTried = false;
}
