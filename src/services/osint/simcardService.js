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
    dbInstance.exec("PRAGMA synchronous = OFF;");
    dbInstance.exec("PRAGMA cache_size = -32000;");
    dbInstance.exec("PRAGMA mmap_size = 268435456;");
    dbInstance.exec("PRAGMA temp_store = MEMORY;");

    queryPhoneStmt = dbInstance.prepare(`
      SELECT * FROM simcard WHERE phone IN (?, ?, ?, ?) LIMIT 15
    `);

    queryNikStmt = dbInstance.prepare(`
      SELECT * FROM simcard WHERE nik = ? LIMIT 20
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

export function normalizePhoneVariants(raw) {
  let cleaned = String(raw || "").replace(/\D+/g, "");
  if (!cleaned) return { intl: "", local: "", plus: "", bare: "" };

  let bare = cleaned;
  if (cleaned.startsWith("62")) {
    bare = cleaned.slice(2);
  } else if (cleaned.startsWith("0")) {
    bare = cleaned.slice(1);
  }

  return {
    intl: "62" + bare,
    local: "0" + bare,
    plus: "+62" + bare,
    bare: bare,
  };
}

export function searchSimcardByPhone(rawPhone) {
  const db = getDatabase();
  if (!db || !queryPhoneStmt) return [];

  const { intl, local, plus, bare } = normalizePhoneVariants(rawPhone);
  if (!intl) return [];

  try {
    return queryPhoneStmt.all(intl, local, plus, bare);
  } catch (err) {
    console.error("[SimcardService] Gagal query nomor:", err);
    return [];
  }
}

export function searchSimcardByNik(nik) {
  const db = getDatabase();
  if (!db || !queryNikStmt) return [];

  const cleanNik = String(nik || "")
    .replace(/\D+/g, "")
    .trim();
  if (!cleanNik) return [];

  try {
    return queryNikStmt.all(cleanNik);
  } catch (err) {
    console.error("[SimcardService] Gagal query NIK:", err);
    return [];
  }
}
