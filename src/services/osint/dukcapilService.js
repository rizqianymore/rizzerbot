import fs from "fs";
import path from "path";
import dns from "node:dns";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import axios from "axios";
import { parseNik, enrichWilayah } from "@/src/services/osint/nikparse.js";
import { parseOperator } from "@/src/services/osint/cekoperator.js";

// Prioritaskan IPv4 untuk menghindari delay/timeout IPv6 pada Node.js
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "../../../database/dukcapil.db");

let dbInstance = null;
let queryNikStmt = null;
let queryPhoneStmt = null;
let queryNameStmt = null;

const geoCache = new Map();

function getDatabase() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DB_PATH)) {
    return null;
  }
  try {
    const stat = fs.statSync(DB_PATH);
    if (!stat.isFile() || stat.size < 1024) {
      console.warn("[DukcapilService] Database file too small/empty:", stat.size);
      return null;
    }
  } catch {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(DB_PATH, { readOnly: true });

    dbInstance.exec("PRAGMA query_only = 1;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");

    queryNikStmt = dbInstance.prepare(`
      SELECT * FROM jakarta WHERE nik = ? LIMIT 1
    `);

    queryPhoneStmt = dbInstance.prepare(`
      SELECT * FROM jakarta WHERE nohp = ? OR nohp = ? LIMIT 10
    `);

    queryNameStmt = dbInstance.prepare(`
      SELECT * FROM jakarta WHERE nama LIKE ? LIMIT 10
    `);

    return dbInstance;
  } catch (err) {
    console.error("[DukcapilService] Gagal membuka database:", err);
    return null;
  }
}

export function isDukcapilReady() {
  try {
    if (!fs.existsSync(DB_PATH)) return false;
    const stat = fs.statSync(DB_PATH);
    return stat.isFile() && stat.size >= 1024;
  } catch {
    return false;
  }
}

/**
 * Parsing tanggal lahir dari string TTL database (cth: "26 APR 1988 (35 TH 2 BLN)")
 */
export function parseBirthDate(ttl) {
  if (!ttl) return null;
  const MONTHS = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MEI: 4, MAY: 4, JUN: 5, JUL: 6,
    AGU: 7, AUG: 7, SEP: 8, OKT: 9, OCT: 9, NOV: 10, DES: 11, DEC: 11
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
 * Geocoding OpenStreetMap dengan in-memory cache dan retry aman
 */
export async function getCoordinates(query) {
  if (!query) return null;
  const key = String(query).toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);

  const cleanQuery = query.replace(/[^\w\s,.-]/gi, " ").trim();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 300));
      const res = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: cleanQuery,
          format: "json",
          limit: 1,
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "id,en;q=0.9",
        },
        timeout: 5000,
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
      break;
    } catch {
      if (attempt === 1) return null;
    }
  }

  return null;
}

/**
 * Penentuan titik koordinat akurat bertingkat (Jalan spesifik -> Kelurahan -> Kecamatan -> Kota)
 */
export async function resolveAccurateCoordinates(alamat, kelurahan, kecamatan, kota_kab) {
  const cleanCity = String(kota_kab || "")
    .replace(/KOTA\s+ADM\.?\s*/i, "")
    .replace(/KABUPATEN\s*/i, "")
    .replace(/KAB\.?\s*/i, "")
    .trim() || "Jakarta";

  const cleanKel = String(kelurahan || "").trim();
  const cleanKec = String(kecamatan || "").trim();

  let addr = String(alamat || "").trim();
  let streetRaw = addr.split(/\s+RT\s+/i)[0].split(/\s+RW\s+/i)[0];

  // Pisahkan pengulangan kelurahan jika tercantum di bagian awal
  if (cleanKel && cleanKel.length > 3) {
    const kelRegex = new RegExp("\\b" + cleanKel + "\\b", "i");
    const idx = streetRaw.search(kelRegex);
    if (idx > 4) streetRaw = streetRaw.slice(0, idx).trim();
  }

  const isGang = /^(GG|GANG)\.?\s*/i.test(streetRaw);
  let street = streetRaw.replace(/^(JL|JLN|JALAN|GG|GANG)\.?\s*/i, "").trim();

  // Pisahkan nomor rumah dan slash (cth: V/75 -> V)
  street = street
    .replace(/\/\d+[A-Za-z]?$/, "")
    .replace(/\s+(?:NO\.?|NOMOR)\s*\d+[A-Za-z]?/i, "")
    .trim();

  // Normalisasi singkatan kata umum alamat di Indonesia
  street = street
    .replace(/\bKAMP\b/gi, "Kampung")
    .replace(/\bKP\b/gi, "Kampung")
    .replace(/\bKOMP\b/gi, "Komplek")
    .replace(/\bPERUM\b/gi, "Perumahan")
    .trim();

  const prefix = isGang ? "Gang " : "Jalan ";

  const candidates = [];
  if (street.length >= 3) {
    candidates.push(prefix + street + ", " + cleanCity);
    if (cleanKel) candidates.push(prefix + street + ", " + cleanKel + ", " + cleanCity);
  }
  if (cleanKel) candidates.push(cleanKel + ", " + cleanCity);
  if (cleanKec) candidates.push(cleanKec + ", " + cleanCity);
  candidates.push(cleanCity);

  for (const q of candidates) {
    const coord = await getCoordinates(q);
    if (coord) return coord;
  }

  return null;
}

/**
 * Normalisasi nomor HP ke format internasional (628...) dan lokal (08...)
 */
export function normalizePhone(raw) {
  let clean = String(raw || "").trim().replace(/[^0-9]/g, "");
  if (!clean) return { intl: "", local: "" };

  if (clean.startsWith("62")) {
    return {
      intl: clean,
      local: "0" + clean.slice(2),
    };
  }
  if (clean.startsWith("0")) {
    return {
      intl: "62" + clean.slice(1),
      local: clean,
    };
  }
  return {
    intl: "62" + clean,
    local: "0" + clean,
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

  if (digitsOnly.length >= 9 && digitsOnly.length <= 15 && (digitsOnly.startsWith("62") || digitsOnly.startsWith("08"))) {
    const phones = normalizePhone(digitsOnly);
    return { type: "phone", value: phones.intl, phones };
  }

  return { type: "name", value: clean };
}

/**
 * Cari data berdasarkan NIK
 */
export async function searchByNik(rawNik) {
  const db = getDatabase();
  const nik = String(rawNik).trim().replace(/[^0-9]/g, "");
  if (!nik) return null;

  let nikInfo = null;
  const parsed = parseNik(nik);
  if (parsed.valid) {
    nikInfo = await enrichWilayah(parsed);
  }

  let record = null;
  if (db && queryNikStmt) {
    record = queryNikStmt.get(nik) || null;
  }

  let operatorInfo = null;
  if (record?.nohp) {
    const op = parseOperator(record.nohp);
    if (op.valid) operatorInfo = op;
  }

  let location = null;
  if (record) {
    location = await resolveAccurateCoordinates(
      record.alamat,
      record.kelurahan,
      record.kecamatan,
      record.kota_kab
    );
  }

  return {
    record,
    nikInfo,
    operatorInfo,
    location,
  };
}

/**
 * Cari data berdasarkan No HP
 */
export async function searchByPhone(rawPhone) {
  const db = getDatabase();
  const phones = normalizePhone(rawPhone);
  if (!phones.intl) return { records: [], operatorInfo: null, location: null };

  const operatorInfo = parseOperator(phones.local);

  let records = [];
  if (db && queryPhoneStmt) {
    records = queryPhoneStmt.all(phones.intl, phones.local);
  }

  let location = null;
  if (records.length > 0) {
    const primary = records[0];
    location = await resolveAccurateCoordinates(
      primary.alamat,
      primary.kelurahan,
      primary.kecamatan,
      primary.kota_kab
    );
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
  };
}

/**
 * Cari data berdasarkan Nama
 */
export async function searchByName(rawName, limit = 5) {
  const db = getDatabase();
  const name = String(rawName).trim();
  if (!name || !db || !queryNameStmt) return [];

  const pattern = `%${name.toUpperCase()}%`;
  const records = queryNameStmt.all(pattern);

  return records.slice(0, limit);
}
