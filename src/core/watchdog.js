import process from "process";
import v8 from "v8";
import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";

let _watchdogTimer = null;
let _lastHeartbeat = Date.now();
const MAX_ALLOWED_RAM_MB = 900; // Toleransi Max RAM 900MB sebelum garbage collector / flush

export function recordSocketHeartbeat() {
  _lastHeartbeat = Date.now();
}

export function startAutonomousWatchdog(sockGetter, logger) {
  if (_watchdogTimer) clearInterval(_watchdogTimer);

  _watchdogTimer = setInterval(async () => {
    try {
      const sock = typeof sockGetter === "function" ? sockGetter() : sockGetter;
      const now = Date.now();

      // 1. Dead Socket / Silent Freeze Detection
      const timeSinceHeartbeat = now - _lastHeartbeat;
      // Jika socket sudah connect tapi tidak ada aktivitas / ping selama > 5 menit
      if (sock?.ws && sock.ws.isOpen && timeSinceHeartbeat > 300_000) {
        if (logger) {
          logger.warn(`[Watchdog] Dead socket heartbeat detected (${(timeSinceHeartbeat / 1000).toFixed(0)}s idle). Sending ping...`);
        }
        try {
          // Kirim WS ping
          sock.ws.ping();
          _lastHeartbeat = now;
        } catch (_) {}
      }

      // 2. RAM Memory Compactor & Garbage Collection
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const rssMB = memoryUsage.rss / 1024 / 1024;

      if (heapUsedMB > MAX_ALLOWED_RAM_MB || rssMB > 1100) {
        if (logger) {
          logger.warn(
            `[Watchdog RAM Alert] High memory consumption: Heap: ${heapUsedMB.toFixed(1)}MB, RSS: ${rssMB.toFixed(1)}MB. Performing auto-compaction...`
          );
        }

        // Trigger manual garbage collection jika flag v8 terekspos
        if (global.gc) {
          global.gc();
        }

        // Flush memory database & save
        db.flushSync();

        if (logger) {
          logger.info("[Watchdog RAM] Memory compaction and state flush completed.");
        }
      }
    } catch (err) {
      if (logger) {
        logger.error(`[Watchdog Error] Heartbeat check error: ${err.message}`);
      }
    }
  }, 60_000);

  if (_watchdogTimer && typeof _watchdogTimer.unref === "function") {
    _watchdogTimer.unref();
  }

  if (logger) {
    logger.info("[Autonomous Watchdog] Watchdog & Self-Healing engine active (60s tick).");
  }
}

/**
 * Notifikasi restart/recovery ke Owner jika terjadi crash sebelumnya
 */
export async function sendRecoveryReport(sock, logger) {
  try {
    const ownerJid = db.normalizeJid(settings.ownerNumber);
    if (!ownerJid || !sock) return;

    const uptime = (process.uptime() / 60).toFixed(1);
    const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const report =
      `🤖 *[SYSTEM SELF-HEALING & WATCHDOG]*\n\n` +
      `🟢 *Status:* Bot berhasil online & self-healing aktif.\n` +
      `• Uptime: ${uptime} menit\n` +
      `• Heap RAM: ${heapUsed} MB\n` +
      `• Node Version: ${process.version}\n` +
      `• Platform: ${process.platform} (${process.arch})\n` +
      `• Waktu: ${new Date().toLocaleString("id-ID")}`;

    await sock.sendMessage(ownerJid, { text: report }).catch(() => {});
  } catch (_) {}
}
