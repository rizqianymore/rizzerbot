const HEARTBEAT_MS = 4 * 60 * 1000;
const MAX_FAILS = 3;
const LAG_WATCH_MS = 60 * 1000;
const LAG_WARN_MS = 500;

export function startKeepAlive(sock, { logger = console, restart = null, intervalMs = HEARTBEAT_MS } = {}) {
  let fails = 0;
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      await sock?.sendPresenceUpdate?.("available");
      fails = 0;
    } catch (err) {
      fails += 1;
      try {
        logger?.warn?.(`[KeepAlive] heartbeat gagal ${fails}x: ${err?.message || err}`);
      } catch (_) {}
      if (fails >= MAX_FAILS) {
        fails = 0;
        try {
          logger?.warn?.("[KeepAlive] socket diduga stale, restart koneksi...");
        } catch (_) {}
        try {
          await restart?.();
        } catch (_) {}
      }
    }
  }, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function startStabilityWatchdog({ logger = console, intervalMs = LAG_WATCH_MS } = {}) {
  let stopped = false;
  let last = Date.now();
  const timer = setInterval(() => {
    if (stopped) return;
    const now = Date.now();
    const lag = now - last - intervalMs;
    last = now;
    if (lag >= LAG_WARN_MS) {
      try {
        const mem = Math.round((process.memoryUsage()?.heapUsed || 0) / 1024 / 1024);
        logger?.warn?.(`[Stability] event-loop lag ${lag}ms (heap ${mem}MB) — 1 tugas berat memblokir semua perintah`);
      } catch (_) {}
    }
  }, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
