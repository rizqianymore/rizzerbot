import fs from "node:fs";
import path from "node:path";
import { logger } from "./connection/logger.js";
import { db } from "@/src/core/database.js";

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

const MAX_SESSION_FAILURES = 3;

const FAILURE_WINDOW_MS = 10 * 60 * 1000;

const RESET_COOLDOWN_MS = 5 * 1000;

const TRACKER_TTL_MS = 60 * 60 * 1000;

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
  if (!errorMessage) return true;
  const message = String(errorMessage);
  return SESSION_ERROR_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()));
}

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

export function isInResetCooldown(jid) {
  if (!jid) return false;
  const entry = failureTracker.get(jid);
  if (!entry || !entry.lastReset) return false;
  return Date.now() - entry.lastReset < RESET_COOLDOWN_MS;
}

export async function resetSessionIfThresholdReached(jid, sock, count) {
  if (!jid) return false;
  const targetCount = count || 1;
  if (targetCount < MAX_SESSION_FAILURES) return false;

  if (isInResetCooldown(jid)) {
    return false;
  }

  try {
    await sock.signalRepository?.deleteSession?.([jid]);

    const rawId = String(jid).split("@")[0].split(":")[0];
    const candidateIds = new Set([rawId]);
    try {
      const mappedPn = db.resolvePhoneJid(jid);
      if (mappedPn) candidateIds.add(String(mappedPn).split("@")[0].split(":")[0]);
    } catch (_) {}

    const authDir = path.resolve(process.cwd(), "assets", "sessions", "primary_bot");
    if (fs.existsSync(authDir)) {
      try {
        const files = fs.readdirSync(authDir);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          for (const id of candidateIds) {
            if (id && id.length >= 5 && (file.startsWith(`session-${id}`) || file.startsWith(`identity-key-${id}`))) {
              try {
                fs.unlinkSync(path.join(authDir, file));
              } catch (_) {}
              break;
            }
          }
        }
      } catch (_) {}
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
