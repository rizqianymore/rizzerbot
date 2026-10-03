import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../database/samsat.db');

let dbInstance = null;
let queryPlateStmt = null;
let queryNikStmt = null;

function getDatabase() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DB_PATH)) {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(DB_PATH, { readOnly: true });
    // Performance tuning for fast concurrent reads
    dbInstance.exec('PRAGMA query_only = 1;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');

    queryPlateStmt = dbInstance.prepare(`
      SELECT * FROM samsat WHERE number = ? LIMIT 1
    `);

    queryNikStmt = dbInstance.prepare(`
      SELECT * FROM samsat WHERE nik = ? LIMIT 10
    `);

    return dbInstance;
  } catch (err) {
    console.error('[SamsatService] Gagal membuka database:', err);
    return null;
  }
}

/**
 * Mencari data kendaraan berdasarkan Plat Nomor.
 * @param {string} rawPlate - Nomor plat kendaraan (misal: "B 1234 ABC" atau "b1234abc")
 * @returns {object|null} Data kendaraan atau null jika tidak ditemukan
 */
export function searchByPlate(rawPlate) {
  const db = getDatabase();
  if (!db || !queryPlateStmt) {
    throw new Error('Database SAMSAT belum diinisialisasi atau file database/samsat.db tidak ditemukan.');
  }

  const cleanPlate = String(rawPlate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleanPlate) return null;

  return queryPlateStmt.get(cleanPlate) || null;
}

/**
 * Mencari data kendaraan berdasarkan NIK pemilik.
 * @param {string} rawNik - NIK pemilik (16 digit)
 * @returns {Array} Daftar kendaraan milik NIK tersebut
 */
export function searchByNik(rawNik) {
  const db = getDatabase();
  if (!db || !queryNikStmt) {
    throw new Error('Database SAMSAT belum diinisialisasi atau file database/samsat.db tidak ditemukan.');
  }

  const cleanNik = String(rawNik).trim();
  if (!cleanNik) return [];

  return queryNikStmt.all(cleanNik);
}

/**
 * Cek status kesiapan database SAMSAT.
 */
export function isSamsatReady() {
  return fs.existsSync(DB_PATH);
}
