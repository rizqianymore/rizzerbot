const HEARTBEAT_MS = 2 * 60 * 1000;
const MAX_FAILS = 4;
const LAG_SAMPLE_MS = 2000;
const LAG_WARN_MS = 2000;

export function startKeepAlive(sock, { logger = console, restart = null, intervalMs = HEARTBEAT_MS } = {}) {
  let fails = 0;
  let stopped = false;
  let inFlight = false;
  const timer = setInterval(async () => {
    if (stopped || inFlight) return;

    if (!sock?.authState?.creds?.registered || !sock?.ws?.isOpen) return;
    inFlight = true;
    try {
      await Promise.race([
        sock?.sendPresenceUpdate?.("available"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Presence timeout")), 12000)),
      ]);
      fails = 0;
    } catch (err) {
      fails += 1;
      try {
        logger?.warn?.(`[KeepAlive] heartbeat gagal ${fails}x: ${err?.message || err}`);
      } catch (_) { }
      if (fails >= MAX_FAILS) {
        fails = 0;
        try {
          logger?.warn?.("[KeepAlive] socket latency tinggi / stale, auto recover koneksi...");
        } catch (_) { }
        try {
          await restart?.();
        } catch (_) { }
      }
    } finally {
      inFlight = false;
    }
  }, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function startStabilityWatchdog({ logger = console, sampleMs = LAG_SAMPLE_MS } = {}) {
  let stopped = false;
  let last = Date.now();
  const timer = setInterval(() => {
    if (stopped) return;
    const now = Date.now();
    const lag = now - last - sampleMs;
    last = now;
    if (lag >= LAG_WARN_MS) {
      try {
        const mem = Math.round((process.memoryUsage()?.heapUsed || 0) / 1024 / 1024);
        logger?.warn?.(`[Stability] event-loop lag ${lag}ms (heap ${mem}MB) — event loop terbebani sementara`);
      } catch (_) { }
    }
  }, sampleMs);
  if (timer.unref) timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
