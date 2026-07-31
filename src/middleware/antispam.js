const cooldowns = new Map();
const burstGuard = new Map();
const BURST_LIMIT = 5;
const BURST_WINDOW = 10_000;
const BURST_BLOCK_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [jid, time] of cooldowns.entries()) {
    if (now - time > 60_000) cooldowns.delete(jid);
  }
  for (const [jid, rec] of burstGuard.entries()) {
    if (now - rec.windowStart > 60_000 && rec.blockedUntil < now) {
      burstGuard.delete(jid);
    }
  }
}, 300_000);

export function checkBurst(jid) {
  const now = Date.now();
  let rec = burstGuard.get(jid);

  if (!rec) {
    rec = { count: 0, windowStart: now, blockedUntil: 0 };
  }

  if (rec.blockedUntil > now) {
    return rec.blockedUntil - now;
  }

  if (now - rec.windowStart > BURST_WINDOW) {
    rec.count = 0;
    rec.windowStart = now;
  }

  rec.count++;

  if (rec.count > BURST_LIMIT) {
    rec.blockedUntil = now + BURST_BLOCK_MS;
    rec.count = 0;
    burstGuard.set(jid, rec);
    return BURST_BLOCK_MS;
  }

  burstGuard.set(jid, rec);
  return 0;
}

export function checkCooldown(jid, duration = 3000) {
  const now = Date.now();
  const lastUsed = cooldowns.get(jid) || 0;
  if (now - lastUsed < duration) {
    return duration - (now - lastUsed);
  }
  cooldowns.set(jid, now);
  return 0;
}
