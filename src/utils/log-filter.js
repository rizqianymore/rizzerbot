// Filter log noise yang TEPAT dari libsignal/baileys.
// Hanya menyenyapkan pattern yang terbukti noise (lihat pm2 logs).
// Cara pakai: import file ini PALING AWAL (baris 1 di index.js).
// Bypass: LOG_VERBOSE=1 atau DEBUG_LIBSIGNAL=1 untuk tampilkan semua.

const BYPASS = process.env.LOG_VERBOSE === "1" || process.env.DEBUG_LIBSIGNAL === "1";

// Daftar eksak dari node_modules/libsignal/src/*.js — JANGAN tambah yang lain sembarangan.
const SUPPRESSED_SUBSTRINGS = [
  // session_builder.js:74
  "Closing open session in favor of incoming prekey bundle",
  // session_cipher.js:157,159 — gagal decrypt 1 pesan duplikat/out-of-order
  "Failed to decrypt message with any known session",
  "Key used already or never filled",
  "MessageCounterError",
  // session_cipher.js:182 — info biasa
  "Decrypted message with closed session",
  // session_record.js:270,273,279,281,301,193 — dump object session (rootKey/indexInfo/pendingPreKey)
  "Session already closed",
  "Closing session:",
  "Session already open",
  "Opening session:",
  "Removing old closed session:",
  "Migrating session to:",
  "V1 session storage migration error",
];

function argsToText(args) {
  try {
    return args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
        if (typeof a === "object") {
          // Jangan JSON.stringify Buffer besar — cukup cek constructor/name
          const s = String(a?.message || a?.stack || "");
          if (s && s !== "[object Object]") return s;
          return "";
        }
        return String(a ?? "");
      })
      .join(" ");
  } catch {
    return "";
  }
}

export function shouldSuppressLog(...args) {
  if (BYPASS) return false;
  if (!args.length) return false;
  const text = argsToText(args);
  if (!text) {
    // console.info("Closing session:", sessionObject) → arg pertama cocok,
    // arg kedua object kosong-string. Cek arg pertama saja.
    const first = typeof args[0] === "string" ? args[0] : "";
    return SUPPRESSED_SUBSTRINGS.some((p) => first.includes(p));
  }
  return SUPPRESSED_SUBSTRINGS.some((p) => text.includes(p));
}

let _patched = false;
export function installLogFilter() {
  if (_patched || BYPASS) return;
  _patched = true;
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    const orig = console[method]?.bind(console);
    if (!orig) continue;
    console[method] = (...args) => {
      if (shouldSuppressLog(...args)) return;
      orig(...args);
    };
  }
}

installLogFilter();
