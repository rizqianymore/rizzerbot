import fs from "node:fs";
import path from "node:path";
import { logger } from "./connection/logger.js";

/*
 * Pemulihan sesi Signal yang desinkron.
 *
 * Saat pesan masuk gagal didekripsi oleh libsignal karena sesi tidak sinkron
 * (Over 2000 messages into the future / Bad MAC / no matching session), baileys
 * hanya mencatat kesalahan dan menyisipkan pesan sebagai CIPHERTEXT stub (stubType 2).
 * Sesi yang rusak akan terus digunakan untuk pesan berikutnya dari kontak yang sama,
 * sehingga kegagalan berulang dan pesan tidak masuk ke bot.
 *
 * Modul ini mendeteksi kegagalan dekripsi per JID dan mereset sesi Signal
 * (menghapusnya dari auth store & disk), sehingga pesan selanjutnya akan
 * memaksa pembentukan sesi baru melalui pre-key / ratchet exchange.
 */

const SESSION_ERROR_PATTERNS = [
  "Over 2000 messages into the future",
  "Bad MAC",
  "No matching sessions found for message",
  "No session record",
  "Chain closed",
  "Key used already or never filled",
  "Decryption failed",
  "CIPHERTEXT",
];

// Reset segera pada kegagalan pertama agar pesan berikutnya langsung pulih
const MAX_SESSION_FAILURES = 1;
// Jendela waktu untuk menghitung kegagalan (10 menit).
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
// Cooldown minimal (5 detik) untuk mencegah reset loop dalam millisecond yang sama
const RESET_COOLDOWN_MS = 5 * 1000;
// Bersihkan entri tracker yang lebih tua dari jendela ini (1 jam).
const TRACKER_TTL_MS = 60 * 60 * 1000;

// jid => { count, lastError, lastTime, lastReset }
const failureTracker = new Map();

let _cleanupTimer = null;

function startCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [jid, entry] of failureTracker.entries()) {
      if (now - entry.lastTime > TRACKER_TTL_MS) {
        failureTracker.delete(jid);
      }
    }
  }, TRACKER_TTL_MS);
  _cleanupTimer.unref?.();
}

startCleanupTimer();

function isSessionDesyncError(errorMessage) {
  if (!errorMessage) return true; // Default anggap session error jika stub ciphertext tanpa parameter
  const message = String(errorMessage);
  return SESSION_ERROR_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()));
}

/**
 * Catat kegagalan dekripsi sesi untuk sebuah JID.
 * Mengembalikan jumlah kegagalan terkini, atau null jika bukan kesalahan sesi.
 */
export function recordDecryptionFailure(jid, errorMessage) {
  if (!jid) return null;
  if (errorMessage && !isSessionDesyncError(errorMessage)) return null;

  const now = Date.now();
  let entry = failureTracker.get(jid);
  if (!entry || now - entry.lastTime > FAILURE_WINDOW_MS) {
    entry = { count: 0, lastError: "", lastTime: 0, lastReset: 0 };
  }
  entry.count += 1;
  entry.lastError = errorMessage || "Ciphertext decrypt failure";
  entry.lastTime = now;
  failureTracker.set(jid, entry);
  return entry.count;
}

/**
 * Cek apakah JID masih dalam cooldown setelah reset terakhir.
 */
export function isInResetCooldown(jid) {
  if (!jid) return false;
  const entry = failureTracker.get(jid);
  if (!entry || !entry.lastReset) return false;
  return Date.now() - entry.lastReset < RESET_COOLDOWN_MS;
}

/**
 * Hapus sesi Signal untuk JID jika ambang batas kegagalan tercapai.
 * Membersihkan sesi dari memori soket Baileys serta file sesi di disk.
 */
export async function resetSessionIfThresholdReached(jid, sock, count) {
  if (!jid) return false;
  const targetCount = count || 1;
  if (targetCount < MAX_SESSION_FAILURES) return false;

  // Hindari reset berulang dalam interval milidetik yang sama
  if (isInResetCooldown(jid)) {
    return false;
  }

  try {
    // 1. Hapus dari Baileys Signal Repository
    await sock.signalRepository?.deleteSession?.([jid]);

    // 2. Bersihkan file sesi fisik dari disk (authDir)
    const rawId = String(jid).split("@")[0].split(":")[0];
    if (rawId && rawId.length >= 5) {
      const authDir = path.resolve(process.cwd(), "assets", "sessions", "primary_bot");
      if (fs.existsSync(authDir)) {
        try {
          const files = fs.readdirSync(authDir);
          for (const file of files) {
            if (
              (file.startsWith(`session-${rawId}`) || file.startsWith(`identity-key-${rawId}`)) &&
              file.endsWith(".json")
            ) {
              try {
                fs.unlinkSync(path.join(authDir, file));
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    const entry = failureTracker.get(jid) || {};
    entry.lastReset = Date.now();
    entry.count = 0;
    failureTracker.set(jid, entry);

    logger.warn(
      `[Session Recovery] Sesi Signal untuk ${jid} berhasil direset dan dibersihkan dari disk. ` +
        `Pesan berikutnya akan menegosiasikan ratchet session baru secara otomatis.`
    );
    return true;
  } catch (err) {
    logger.error(`[Session Recovery] Gagal mereset sesi ${jid}:`, err.message || err);
    return false;
  }
}

/**
 * Reset paksa semua sesi Signal individu (nuclear option).
 * Digunakan ketika terlalu banyak ciphertext berurutan.
 */
export async function emergencyResetAllSessions(sock) {
  try {
    const authDir = path.resolve(process.cwd(), "assets", "sessions", "primary_bot");
    let deletedCount = 0;
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        if (file.startsWith("session-") && file.endsWith(".json")) {
          try {
            fs.unlinkSync(path.join(authDir, file));
            deletedCount++;
          } catch (_) {}
        }
      }
    }

    failureTracker.clear();

    logger.warn(
      `[Session Recovery] Reset darurat: ${deletedCount} file sesi Signal dibersihkan dari disk. ` +
        `Semua pesan berikutnya akan membentuk sesi baru.`
    );
    return deletedCount;
  } catch (err) {
    logger.error("[Session Recovery] Gagal reset darurat sesi:", err.message || err);
    return 0;
  }
}

export const SESSION_FAILURE_THRESHOLD = MAX_SESSION_FAILURES;

export function getSessionRecoveryStats() {
  const now = Date.now();
  const stats = {
    trackedJids: failureTracker.size,
    failures: [],
    recentResets: 0,
  };
  for (const [jid, entry] of failureTracker.entries()) {
    stats.failures.push({
      jid,
      count: entry.count,
      lastError: entry.lastError,
      lastFailureAgoMs: now - entry.lastTime,
      inCooldown: isInResetCooldown(jid),
    });
    if (entry.lastReset && now - entry.lastReset < RESET_COOLDOWN_MS) {
      stats.recentResets += 1;
    }
  }
  return stats;
}
