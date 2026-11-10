import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SIMCARD_DB_PATH = path.resolve(__dirname, "../../../database/simcard.db");

let dbInstance = null;
let queryPhoneStmt = null;
let queryNikStmt = null;

function getDatabase() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(SIMCARD_DB_PATH)) return null;

  try {
    const stat = fs.statSync(SIMCARD_DB_PATH);
    if (!stat.isFile() || stat.size < 1024) return null;
  } catch {
    return null;
  }

  try {
    dbInstance = new DatabaseSync(SIMCARD_DB_PATH, { readOnly: true });
    dbInstance.exec("PRAGMA query_only = 1;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");

    queryPhoneStmt = dbInstance.prepare(`
      SELECT * FROM simcard WHERE phone = ? OR phone = ? LIMIT 10
    `);

    queryNikStmt = dbInstance.prepare(`
      SELECT * FROM simcard WHERE nik = ? LIMIT 10
    `);

    return dbInstance;
  } catch (err) {
    console.error("[SimcardService] Gagal membuka simcard.db:", err);
    return null;
  }
}

export function isSimcardReady() {
  try {
    if (!fs.existsSync(SIMCARD_DB_PATH)) return false;
    const stat = fs.statSync(SIMCARD_DB_PATH);
    return stat.isFile() && stat.size >= 1024;
  } catch {
    return false;
  }
}

function normalizePhoneVariants(raw) {
  let cleaned = String(raw || "").replace(/\D+/g, "");
  if (!cleaned) return { intl: "", local: "" };

  if (cleaned.startsWith("0")) {
    return {
      intl: "62" + cleaned.slice(1),
      local: cleaned,
    };
  }
  if (cleaned.startsWith("62")) {
    return {
      intl: cleaned,
      local: "0" + cleaned.slice(2),
    };
  }
  return {
    intl: "62" + cleaned,
    local: "0" + cleaned,
  };
}

/**
 * Mencari data registrasi simcard berdasarkan Nomor HP
 */
export function searchSimcardByPhone(rawPhone) {
  const db = getDatabase();
  if (!db || !queryPhoneStmt) return [];

  const { intl, local } = normalizePhoneVariants(rawPhone);
  if (!intl && !local) return [];

  try {
    return queryPhoneStmt.all(intl, local);
  } catch (err) {
    console.error("[SimcardService] Gagal query nomor:", err);
    return [];
  }
}

/**
 * Mencari data nomor terdaftar berdasarkan NIK
 */
export function searchSimcardByNik(nik) {
  const db = getDatabase();
  if (!db || !queryNikStmt) return [];

  const cleanNik = String(nik || "").replace(/\D+/g, "").trim();
  if (!cleanNik) return [];

  try {
    return queryNikStmt.all(cleanNik);
  } catch (err) {
    console.error("[SimcardService] Gagal query NIK:", err);
    return [];
  }
}
