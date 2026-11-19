import fs from "fs";
import path from "path";
import dns from "node:dns";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import axios from "axios";
import { parseNik, enrichWilayah } from "@/src/services/osint/nikparse.js";
import { parseOperator } from "@/src/services/osint/cekoperator.js";
import { searchSimcardByPhone, searchSimcardByNik, isSimcardReady } from "@/src/services/osint/simcardService.js";

// Prioritaskan IPv4 untuk menghindari delay/timeout IPv6 pada Node.js
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) { }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_TOP_PATH = path.resolve(__dirname, "../../../database/dukcapil_top.db");
const DB_FALLBACK_PATH = path.resolve(__dirname, "../../../database/dukcapil.db");

let dbInstance = null;
let activeDbPath = null;
let detectedTables = [];
const nikStmts = new Map();
const phoneStmts = new Map();
const nameExactStmts = new Map();
const nameRangeStmts = new Map();
const namePrefixAndLikeStmts = new Map();

const TABLE_PREFIX_MAP = {
  31: "dki_jakarta",
  32: "jawa_barat",
  33: "jawa_tengah",
  35: "jawa_timur",
  36: "banten",
  12: "sumatera_utara",
};

const geoCache = new Map();

function getActiveDbPath() {
  if (fs.existsSync(DB_TOP_PATH)) {
    try {
      const stat = fs.statSync(DB_TOP_PATH);
      if (stat.isFile() && stat.size >= 1024) return DB_TOP_PATH;
    } catch (_) { }
  }
  if (fs.existsSync(DB_FALLBACK_PATH)) {
    try {
      const stat = fs.statSync(DB_FALLBACK_PATH);
      if (stat.isFile() && stat.size >= 1024) return DB_FALLBACK_PATH;
    } catch (_) { }
  }
  return null;
}

function getDatabase() {
  if (dbInstance) return dbInstance;
  const targetPath = getActiveDbPath();
  if (!targetPath) return null;

  try {
    dbInstance = new DatabaseSync(targetPath, { readOnly: true });
    activeDbPath = targetPath;

    dbInstance.exec("PRAGMA query_only = 1;");
    dbInstance.exec("PRAGMA synchronous = OFF;");
    dbInstance.exec("PRAGMA cache_size = -64000;");
    dbInstance.exec("PRAGMA mmap_size = 536870912;");
    dbInstance.exec("PRAGMA temp_store = MEMORY;");

    const tableRows = dbInstance
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
      .all();
    detectedTables = tableRows.map((r) => r.name);

    for (const table of detectedTables) {
      nikStmts.set(table, dbInstance.prepare(`SELECT * FROM ${table} WHERE nik = ? LIMIT 1`));
      phoneStmts.set(table, dbInstance.prepare(`SELECT * FROM ${table} WHERE nohp IN (?, ?, ?, ?) LIMIT 10`));
      nameExactStmts.set(table, dbInstance.prepare(`SELECT * FROM ${table} WHERE nama = ? LIMIT 10`));
      nameRangeStmts.set(table, dbInstance.prepare(`SELECT * FROM ${table} WHERE nama >= ? AND nama < ? LIMIT 10`));
      namePrefixAndLikeStmts.set(table, dbInstance.prepare(`SELECT * FROM ${table} WHERE nama >= ? AND nama < ? AND nama LIKE ? LIMIT 10`));
    }

    return dbInstance;
  } catch (err) {
    console.error("[DukcapilService] Gagal membuka database:", err);
    return null;
  }
}

export function isDukcapilReady() {
  return Boolean(getActiveDbPath());
}

export function getDukcapilInfo() {
  const active = getActiveDbPath();
  return {
    path: active,
    name: active ? path.basename(active) : null,
    tables: detectedTables,
  };
}

/**
 * Parsing tanggal lahir dari string TTL database (cth: "26 APR 1988 (35 TH 2 BLN)")
 */
export function parseBirthDate(ttl) {
  if (!ttl) return null;
  const MONTHS = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MEI: 4,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AGU: 7,
    AUG: 7,
    SEP: 8,
    OKT: 9,
    OCT: 9,
    NOV: 10,
    DES: 11,
    DEC: 11,
  };
  const match = String(ttl).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monStr = match[2].toUpperCase();
  const year = parseInt(match[3], 10);
  const month = MONTHS[monStr];
  if (month === undefined) return null;
  return new Date(year, month, day);
}

/**
 * Menghitung umur terkini secara akurat dan otomatis (real-time)
 */
export function formatTtlWithCurrentAge(rawTtl, nikInfo) {
  let birthDate = parseBirthDate(rawTtl);
  let baseDateStr = rawTtl ? String(rawTtl).split("(")[0].trim() : "";

  if (!birthDate && nikInfo?.birthStr) {
    const parts = nikInfo.birthStr.split("-");
    if (parts.length === 3) {
      birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      baseDateStr = nikInfo.birthStr;
    }
  }

  if (!birthDate || isNaN(birthDate.getTime())) return rawTtl || "-";

  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  let days = now.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const ageStr = months > 0 ? `${years} Th ${months} Bln` : `${years} Th`;
  return `${baseDateStr} (${ageStr})`;
}

/**
 * Geocoding OpenStreetMap dengan in-memory cache dan timeout cepat (tidak memblokir bot)
 */
export async function getCoordinates(query) {
  if (!query) return null;
  const key = String(query).toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);

  const cleanQuery = query.replace(/[^\w\s,.-]/gi, " ").trim();

  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: cleanQuery,
        format: "json",
        limit: 1,
      },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RizzerBot/2.0; +https://rizzerbot.id)",
        "Accept-Language": "id,en;q=0.9",
      },
      timeout: 250,
    });

    if (Array.isArray(res.data) && res.data.length > 0) {
      const coord = {
        lat: parseFloat(res.data[0].lat),
        lon: parseFloat(res.data[0].lon),
        displayName: res.data[0].display_name,
      };
      geoCache.set(key, coord);
      return coord;
    }
  } catch {
    // Non-blocking fallback jika offline atau timeout
  }

  geoCache.set(key, null);
  return null;
}

/**
 * Penentuan titik koordinat akurat bertingkat (Jalan spesifik -> Kelurahan -> Kecamatan -> Kota)
 */
export async function resolveAccurateCoordinates(alamat, kelurahan, kecamatan, kota_kab) {
  const cleanCity =
    String(kota_kab || "")
      .replace(/KOTA\s+ADM\.?\s*/i, "")
      .replace(/KABUPATEN\s*/i, "")
      .replace(/KAB\.?\s*/i, "")
      .trim() || "Jakarta";

  const cleanKel = String(kelurahan || "").trim();
  const cleanKec = String(kecamatan || "").trim();

  let addr = String(alamat || "").trim();
  let streetRaw = addr.split(/\s+RT\s+/i)[0].split(/\s+RW\s+/i)[0];

  if (cleanKel && cleanKel.length > 3) {
    const kelRegex = new RegExp("\\b" + cleanKel + "\\b", "i");
    const idx = streetRaw.search(kelRegex);
    if (idx > 4) streetRaw = streetRaw.slice(0, idx).trim();
  }

  const isGang = /^(GG|GANG)\.?\s*/i.test(streetRaw);
  let street = streetRaw.replace(/^(JL|JLN|JALAN|GG|GANG)\.?\s*/i, "").trim();

  street = street
    .replace(/\/\d+[A-Za-z]?$/, "")
    .replace(/\s+(?:NO\.?|NOMOR)\s*\d+[A-Za-z]?/i, "")
    .trim();

  street = street
    .replace(/\bKAMP\b/gi, "Kampung")
    .replace(/\bKP\b/gi, "Kampung")
    .replace(/\bKOMP\b/gi, "Komplek")
    .replace(/\bPERUM\b/gi, "Perumahan")
    .trim();

  const prefix = isGang ? "Gang " : "Jalan ";

  let targetQuery = "";
  if (street.length >= 3) {
    targetQuery = prefix + street + ", " + cleanCity;
  } else if (cleanKel) {
    targetQuery = cleanKel + ", " + cleanCity;
  } else if (cleanKec) {
    targetQuery = cleanKec + ", " + cleanCity;
  } else {
    targetQuery = cleanCity;
  }

  const fastTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 250));
  return await Promise.race([getCoordinates(targetQuery), fastTimeout]);
}

/**
 * Helper rentang prefix B-Tree SQLite untuk pencarian nama ultra-cepat (< 3ms)
 */
export function getPrefixRange(prefix) {
  const clean = String(prefix || "").trim().toUpperCase();
  if (!clean || clean.length < 2) return null;
  const lastChar = clean.slice(-1);
  const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  const upperBound = clean.slice(0, -1) + nextChar;
  return { lower: clean, upper: upperBound };
}

/**
 * Normalisasi nomor HP ke format intl (628...), local (08...), plus (+628...), bare (8...)
 */
export function normalizePhone(raw) {
  let clean = String(raw || "")
    .trim()
    .replace(/[^0-9]/g, "");
  if (!clean) return { intl: "", local: "", plus: "", bare: "" };

  let bare = clean;
  if (clean.startsWith("62")) {
    bare = clean.slice(2);
  } else if (clean.startsWith("0")) {
    bare = clean.slice(1);
  }

  return {
    intl: "62" + bare,
    local: "0" + bare,
    plus: "+62" + bare,
    bare: bare,
  };
}

/**
 * Deteksi jenis input: "nik", "phone", atau "name"
 */
export function classifyQuery(input) {
  const clean = String(input || "").trim();
  const digitsOnly = clean.replace(/[^0-9]/g, "");

  if (/^\d{16}$/.test(clean)) {
    return { type: "nik", value: clean };
  }

  if (/^(\+?62|0)8[1-9][0-9]{6,11}$/.test(clean.replace(/[\s\-]/g, ""))) {
    const phones = normalizePhone(clean);
    return { type: "phone", value: phones.intl, phones };
  }

  if (
    digitsOnly.length >= 9 &&
    digitsOnly.length <= 15 &&
    (digitsOnly.startsWith("62") || digitsOnly.startsWith("08"))
  ) {
    const phones = normalizePhone(digitsOnly);
    return { type: "phone", value: phones.intl, phones };
  }

  return { type: "name", value: clean };
}

/**
 * Cari data berdasarkan NIK dengan integrasi cross-reference Simcard
 */
export async function searchByNik(rawNik) {
  const db = getDatabase();
  const nik = String(rawNik)
    .trim()
    .replace(/[^0-9]/g, "");
  if (!nik) return null;

  const parsed = parseNik(nik);
  let nikInfo = parsed.valid ? { ...parsed } : null;

  let record = null;
  if (db && detectedTables.length > 0) {
    // 1. Prioritaskan tabel berdasarkan 2 digit awal NIK (prefix provinsi)
    const prefix = nik.slice(0, 2);
    const targetTable = TABLE_PREFIX_MAP[prefix];

    if (targetTable && nikStmts.has(targetTable)) {
      const row = nikStmts.get(targetTable).get(nik);
      if (row) {
        record = { ...row, tableSource: targetTable };
      }
    }

    // 2. Jika belum ketemu, cari di seluruh tabel lain yang terdeteksi
    if (!record) {
      for (const table of detectedTables) {
        if (table === targetTable) continue;
        const stmt = nikStmts.get(table);
        if (!stmt) continue;
        const row = stmt.get(nik);
        if (row) {
          record = { ...row, tableSource: table };
          break;
        }
      }
    }
  }

  // Jika tidak ditemukan di database, perkaya wilayah dari API wilayah
  if (!record && nikInfo) {
    nikInfo = await enrichWilayah(nikInfo);
  } else if (record && nikInfo) {
    nikInfo.city = record.kota_kab || nikInfo.city;
    nikInfo.district = record.kecamatan || nikInfo.district;
  }

  // Cross-reference dengan simcard.db untuk nomor HP yang terdaftar pada NIK ini
  let simcards = [];
  if (isSimcardReady()) {
    try {
      simcards = searchSimcardByNik(nik);
    } catch (_) {}
  }

  let operatorInfo = null;
  if (record?.nohp) {
    const op = parseOperator(record.nohp);
    if (op.valid) operatorInfo = op;
  }

  let location = null;
  if (record) {
    location = await resolveAccurateCoordinates(record.alamat, record.kelurahan, record.kecamatan, record.kota_kab);
  }

  return {
    record,
    nikInfo,
    operatorInfo,
    location,
    simcards,
  };
}

/**
 * Cari data berdasarkan No HP (dengan auto-pivot via Simcard NIK)
 */
export async function searchByPhone(rawPhone) {
  const db = getDatabase();
  const phones = normalizePhone(rawPhone);
  if (!phones.intl) return { records: [], operatorInfo: null, location: null, simcards: [] };

  const operatorInfo = parseOperator(phones.local);

  let simcards = [];
  if (isSimcardReady()) {
    try {
      simcards = searchSimcardByPhone(rawPhone);
    } catch (_) {}
  }

  let records = [];
  if (db && detectedTables.length > 0) {
    for (const table of detectedTables) {
      const stmt = phoneStmts.get(table);
      if (!stmt) continue;
      const rows = stmt.all(phones.intl, phones.local, phones.plus, phones.bare);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          records.push({ ...row, tableSource: table });
        }
        if (records.length >= 10) break;
      }
    }
  }

  // Jika tidak ditemukan di database Dukcapil langsung, coba pivot dari NIK Simcard
  if (records.length === 0 && simcards.length > 0) {
    for (const sim of simcards) {
      if (sim.nik && sim.nik.length === 16) {
        const byNik = await searchByNik(sim.nik);
        if (byNik?.record) {
          records.push({
            ...byNik.record,
            simSource: sim.provider || "SIMCARD",
            simDate: sim.date,
          });
        }
      }
    }
  }

  let location = null;
  if (records.length > 0) {
    const primary = records[0];
    location = await resolveAccurateCoordinates(primary.alamat, primary.kelurahan, primary.kecamatan, primary.kota_kab);
  }

  const enrichedRecords = await Promise.all(
    records.map(async (row) => {
      let nikInfo = null;
      if (row.nik && row.nik.length === 16) {
        const parsed = parseNik(row.nik);
        if (parsed.valid) {
          nikInfo = await enrichWilayah(parsed);
        }
      }
      return {
        ...row,
        nikInfo,
      };
    })
  );

  return {
    records: enrichedRecords,
    operatorInfo: operatorInfo.valid ? operatorInfo : null,
    location,
    simcards,
  };
}

/**
 * Cari data berdasarkan Nama dengan pemanfaatan indeks B-Tree SQLite (< 3ms)
 */
export async function searchByName(rawName, limit = 5) {
  const db = getDatabase();
  const name = String(rawName || "").trim().toUpperCase();
  if (!name || !db || detectedTables.length === 0) return [];

  const records = [];
  const seenNiks = new Set();

  // 1. Exact Match via Indeks B-Tree (0ms)
  for (const table of detectedTables) {
    const stmt = nameExactStmts.get(table);
    if (!stmt) continue;
    const rows = stmt.all(name);
    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (!seenNiks.has(row.nik)) {
          seenNiks.add(row.nik);
          records.push({ ...row, tableSource: table });
          if (records.length >= limit) return records;
        }
      }
    }
  }

  // 2. Multi-kata Range Prefix + Filter LIKE (1-3ms)
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const firstWord = words[0];
    const range = getPrefixRange(firstWord);
    if (range && range.lower.length >= 2) {
      const restPattern = `%${words.slice(1).join("%")}%`;
      for (const table of detectedTables) {
        const stmt = namePrefixAndLikeStmts.get(table);
        if (!stmt) continue;
        const rows = stmt.all(range.lower, range.upper, restPattern);
        if (rows && rows.length > 0) {
          for (const row of rows) {
            if (!seenNiks.has(row.nik)) {
              seenNiks.add(row.nik);
              records.push({ ...row, tableSource: table });
              if (records.length >= limit) return records;
            }
          }
        }
      }
    }
  }

  // 3. Single-word Prefix Range Search (1-3ms)
  if (records.length < limit && words.length > 0) {
    const range = getPrefixRange(words[0]);
    if (range && range.lower.length >= 3) {
      for (const table of detectedTables) {
        const stmt = nameRangeStmts.get(table);
        if (!stmt) continue;
        const rows = stmt.all(range.lower, range.upper);
        if (rows && rows.length > 0) {
          for (const row of rows) {
            if (!seenNiks.has(row.nik)) {
              seenNiks.add(row.nik);
              records.push({ ...row, tableSource: table });
              if (records.length >= limit) return records;
            }
          }
        }
      }
    }
  }

  return records.slice(0, limit);
}
