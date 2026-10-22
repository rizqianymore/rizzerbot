import fs from "fs";

/**
 * Vault kredensial siswa Telkom Schools.
 *
 * Aturan:
 * - Password TIDAK PERNAH ditulis di kode, log, atau chat.
 * - Sumber kredensial (berurutan prioritas):
 *   1. env per siswa : TELKOM_PW_<NIS>=<password>
 *   2. env inline    : TELKOM_STUDENT_PASSWORDS={"<NIS>":"<password>"} atau "NIS:password" per baris
 *   3. file vault    : TELKOM_VAULT_FILE=/path/ke/vault.json (isi JSON / teks "NIS:password")
 *   4. pola sekolah  : TELKOM_PASSWORD_PATTERN="dummy@{nis}" (opsional, default NONAKTIF)
 * - Vault hanya dibaca (read-only), tidak pernah ditulis ke disk.
 */

const ENV_INLINE = "TELKOM_STUDENT_PASSWORDS";
const ENV_FILE = "TELKOM_VAULT_FILE";
const ENV_PATTERN = "TELKOM_PASSWORD_PATTERN";
const ENV_PER_STUDENT_PREFIX = "TELKOM_PW_";

export class VaultError extends Error {
  constructor(message, code = "vault_error") {
    super(message);
    this.name = "VaultError";
    this.code = code;
  }
}

function normalizeNisKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function collectEntry(target, nis, password) {
  const cleanNis = normalizeNisKey(nis);
  const cleanPass = typeof password === "string" ? password.trim() : "";
  if (cleanNis && cleanPass) target[cleanNis] = cleanPass;
}

/**
 * Parse isi vault: JSON object, JSON array, atau teks "NIS:password" per baris.
 */
export function parseVaultPayload(raw) {
  const result = {};
  const text = String(raw || "").trim();
  if (!text) return result;

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          collectEntry(result, item.nis ?? item.NIS ?? item.username, item.password ?? item.pass ?? item.secret);
        }
        return result;
      }
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed)) {
          if (value && typeof value === "object") {
            collectEntry(result, key, value.password ?? value.pass ?? value.secret);
          } else {
            collectEntry(result, key, value);
          }
        }
        return result;
      }
    } catch (_) {
      // bukan JSON valid -> lanjut parse sebagai teks
    }
  }

  for (const line of text.split(/[\n\r;]+/)) {
    const match = line.match(/^\s*(\d{4,20})\s*[:=]\s*(.+?)\s*$/);
    if (match) collectEntry(result, match[1], match[2]);
  }
  return result;
}

let fileCache = { path: "", mtimeMs: -1, data: {} };

function readVaultFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (fileCache.path === filePath && fileCache.mtimeMs === stat.mtimeMs) return fileCache.data;
    const raw = fs.readFileSync(filePath, "utf8");
    const data = parseVaultPayload(raw);
    fileCache = { path: filePath, mtimeMs: stat.mtimeMs, data };
    return data;
  } catch (_) {
    return {};
  }
}

function readInlineVault() {
  try {
    return parseVaultPayload(process.env[ENV_INLINE] || "");
  } catch (_) {
    return {};
  }
}

function readPerStudentEnv(nis) {
  const key = `${ENV_PER_STUDENT_PREFIX}${nis}`;
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Pola password bawaan sekolah (opsional, default NONAKTIF).
 * Contoh: TELKOM_PASSWORD_PATTERN="dummy@{nis}" -> password "dummy@539241249".
 */
export function patternPassword(nis) {
  const pattern = String(process.env[ENV_PATTERN] || "").trim();
  if (!pattern) return "";
  const digits = normalizeNisKey(nis);
  if (!digits) return "";
  return pattern.replaceAll("{nis}", digits).replaceAll("{NIS}", digits).replaceAll("%nis%", digits).trim();
}

/**
 * Ambil password siswa dari vault.
 * Melempar VaultError("missing_credential") bila tidak ada.
 */
export function resolvePassword(nis) {
  const digits = normalizeNisKey(nis);
  if (!digits) throw new VaultError("NIS tidak valid.", "invalid_nis");

  const perStudent = readPerStudentEnv(digits);
  if (perStudent) return perStudent;

  const inline = readInlineVault();
  if (inline[digits]) return inline[digits];

  const filePath = String(process.env[ENV_FILE] || "").trim();
  if (filePath) {
    const fromFile = readVaultFile(filePath);
    if (fromFile[digits]) return fromFile[digits];
  }

  const patterned = patternPassword(digits);
  if (patterned) return patterned;

  throw new VaultError("Kredensial siswa belum tersedia di vault.", "missing_credential");
}

/** True bila kredensial tersedia (tanpa membocorkan nilainya). */
export function hasCredential(nis) {
  try {
    resolvePassword(nis);
    return true;
  } catch (_) {
    return false;
  }
}

/** Sumber kredensial untuk audit: "env-siswa" | "env-inline" | "file" | "pola" | null */
export function credentialSource(nis) {
  const digits = normalizeNisKey(nis);
  if (!digits) return null;
  if (readPerStudentEnv(digits)) return "env-siswa";
  if (readInlineVault()[digits]) return "env-inline";
  const filePath = String(process.env[ENV_FILE] || "").trim();
  if (filePath && readVaultFile(filePath)[digits]) return "file";
  if (patternPassword(digits)) return "pola";
  return null;
}

/** Buang cache file vault (dipakai setelah vault diperbarui admin). */
export function clearVaultCache() {
  fileCache = { path: "", mtimeMs: -1, data: {} };
}
