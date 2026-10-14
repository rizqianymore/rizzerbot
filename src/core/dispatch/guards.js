export const userCooldowns = new Map();

const burstTracker = new Map();
const BURST_WINDOW_MS = 10 * 1000;
const BURST_MAX = 6;
const BURST_MUTE_MS = 60 * 1000;

export function isBurstMuted(jid) {
  const now = Date.now();
  const rec = burstTracker.get(jid);
  if (!rec) return false;
  if (rec.mutedUntil && now < rec.mutedUntil) return rec.mutedUntil;
  if (now - rec.windowStart > BURST_WINDOW_MS) {
    burstTracker.delete(jid);
    return false;
  }
  return false;
}

export function registerBurst(jid) {
  const now = Date.now();
  let rec = burstTracker.get(jid);
  if (!rec || now - rec.windowStart > BURST_WINDOW_MS) {
    rec = { count: 1, windowStart: now, mutedUntil: 0 };
  } else {
    rec.count += 1;
  }
  if (rec.count > BURST_MAX) {
    rec.mutedUntil = now + BURST_MUTE_MS;
  }
  burstTracker.set(jid, rec);
  if (burstTracker.size > 2000) {
    for (const [k, v] of burstTracker.entries()) {
      if (now - v.windowStart > BURST_WINDOW_MS && (!v.mutedUntil || now > v.mutedUntil)) {
        burstTracker.delete(k);
      }
    }
  }
  return rec;
}

const crashSenders = new Map();
export function trackCrashSender(jid) {
  if (!jid) return;
  const now = Date.now();
  const rec = crashSenders.get(jid) || { count: 0, first: now, blockedUntil: 0 };
  if (now - rec.first > 60 * 1000) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= 3) rec.blockedUntil = now + 5 * 60 * 1000;
  crashSenders.set(jid, rec);
  if (crashSenders.size > 1000) {
    for (const [k, v] of crashSenders.entries()) {
      if (now > v.blockedUntil && now - v.first > 60 * 1000) crashSenders.delete(k);
    }
  }
}
export function isCrashBlocked(jid) {
  const rec = crashSenders.get(jid);
  return Boolean(rec && Date.now() < rec.blockedUntil);
}

// Owner tetap dibatasi (longgar) supaya sesi owner yang dibajak tidak bisa spam.
// Nilai sengaja longgar supaya owner tetap bisa memakai bot seperti biasa.
const ownerThrottles = new Map();
const OWNER_WINDOW_MS = 10 * 1000;
const OWNER_MAX = 10;

export function registerOwnerCommand(jid) {
  if (!jid) return false;
  const now = Date.now();
  let rec = ownerThrottles.get(jid);
  if (!rec || now - rec.start > OWNER_WINDOW_MS) rec = { count: 0, start: now };
  rec.count += 1;
  ownerThrottles.set(jid, rec);

  if (ownerThrottles.size > 500) {
    for (const [key, value] of ownerThrottles.entries()) {
      if (now - value.start > OWNER_WINDOW_MS * 2) ownerThrottles.delete(key);
    }
  }
  return rec.count > OWNER_MAX;
}
