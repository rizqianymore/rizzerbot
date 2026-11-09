import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import axios from "axios";
import { parseNik, enrichWilayah } from "@/src/services/osint/nikparse.js";
import { parseOperator } from "@/src/services/osint/cekoperator.js";

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
 * Geocoding OpenStreetMap dengan in-memory cache
 */
export async function getCoordinates(query) {
  if (!query) return null;
  const key = String(query).toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);

  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "json",
        limit: 1,
      },
      headers: {
        "User-Agent": "RizzerBot/1.0 (OSINT Geo)",
        "Accept-Language": "id,en;q=0.9",
      },
      timeout: 5000,
    });

    if (Array.isArray(res.data) && res.data.length > 0) {
      const coord = {
        lat: parseFloat(res.data[0].lat),
        lon: parseFloat(res.data[0].lon),
      };
      geoCache.set(key, coord);
      return coord;
    }
  } catch {}

  return null;
}

/**
 * Penentuan titik koordinat akurat bertingkat (Jalan -> Kelurahan -> Kecamatan -> Kota)
 */
export async function resolveAccurateCoordinates(alamat, kelurahan, kecamatan, kota_kab) {
  const cleanCity = String(kota_kab || "")
    .replace(/KOTA\s+ADM\.?\s*/i, "")
    .replace(/KABUPATEN\s*/i, "")
    .replace(/KAB\.?\s*/i, "")
    .trim();

  // 1. Coba ekstraksi nama jalan
  if (alamat) {
    const streetPart = String(alamat)
      .split(/\s+RT\s+/i)[0]
      .split(/\s+RW\s+/i)[0]
      .replace(/^(JL|JLN|JALAN)\.?\s+/i, "")
      .trim();

    if (streetPart.length > 3) {
      const qStreetKel = `Jalan ${streetPart}, ${kelurahan || cleanCity || "Jakarta"}`;
      const resStreetKel = await getCoordinates(qStreetKel);
      if (resStreetKel) return resStreetKel;

      const qStreetCity = `Jalan ${streetPart}, ${cleanCity || "Jakarta"}`;
      const resStreetCity = await getCoordinates(qStreetCity);
      if (resStreetCity) return resStreetCity;
    }
  }

  // 2. Coba Kelurahan + Kota
  if (kelurahan) {
    const qKel = `${kelurahan.trim()}, ${cleanCity || "Jakarta"}`;
    const resKel = await getCoordinates(qKel);
    if (resKel) return resKel;
  }

  // 3. Coba Kecamatan + Kota
  if (kecamatan) {
    const qKec = `${kecamatan.trim()}, ${cleanCity || "Jakarta"}`;
    const resKec = await getCoordinates(qKec);
    if (resKec) return resKec;
  }

  // 4. Fallback ke Kota
  if (cleanCity) {
    return await getCoordinates(cleanCity);
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
