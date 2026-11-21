import os from "node:os";
import { clearNetworkCache } from "./network.js";
import { stealthBrowser } from "@/src/utils/request/browser.js";

const DEFAULT_MEMORY_LIMIT_MB = 450;
const CHECK_INTERVAL_MS = 60 * 1000;

let _guardTimer = null;

export function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    freeSysMemMb: Math.round(os.freemem() / 1024 / 1024),
    totalSysMemMb: Math.round(os.totalmem() / 1024 / 1024),
  };
}

export function performProactiveCleanup(logger = console) {
  try {
    clearNetworkCache();
  } catch (_) {}

  try {
    stealthBrowser.close().catch(() => {});
  } catch (_) {}

  if (typeof global.gc === "function") {
    try {
      global.gc();
      logger?.info?.("[MemoryGuard] Forced Garbage Collection executed.");
    } catch (_) {}
  }
}

export function startMemoryGuard(logger = console, thresholdMb = DEFAULT_MEMORY_LIMIT_MB) {
  if (_guardTimer) return;

  _guardTimer = setInterval(() => {
    const stats = getMemoryStats();
    if (stats.rssMb > thresholdMb) {
      logger?.warn?.(
        `[MemoryGuard] Penggunaan RSS (${stats.rssMb}MB) melampaui batas ambang (${thresholdMb}MB). Menjalankan pembersihan proaktif...`
      );
      performProactiveCleanup(logger);
    }
  }, CHECK_INTERVAL_MS);

  if (_guardTimer.unref) _guardTimer.unref();
}

export function stopMemoryGuard() {
  if (_guardTimer) {
    clearInterval(_guardTimer);
    _guardTimer = null;
  }
}
