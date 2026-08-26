const cooldowns = new Map();
const burstGuard = new Map();
const processedMessageIds = new Map(); // Message ID deduplication map

const BURST_LIMIT = 5;
const BURST_WINDOW = 10_000;
const BURST_BLOCK_MS = 60_000;
const DEDUP_TTL_MS = 60_000; // Simpan history ID pesan selama 60 detik

// Pembersihan rutin cache memori setiap 2 menit
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
  for (const [msgId, time] of processedMessageIds.entries()) {
    if (now - time > DEDUP_TTL_MS) {
      processedMessageIds.delete(msgId);
    }
  }
}, 120_000);

/**
 * Cek apakah ID pesan sudah pernah diproses sebelumnya (Anti-Duplikasi Pesan)
 * Mengembalikan true jika pesan DUPLIKAT, false jika pesan BARU
 */
export function checkDuplicateMessage(msgId) {
  if (!msgId) return false;
  const now = Date.now();

  if (processedMessageIds.has(msgId)) {
    return true; // Duplikat terdeteksi!
  }

  // Tandai pesan sudah diproses
  processedMessageIds.set(msgId, now);

  // Batasi ukuran map memori maksimal 5.000 entri untuk efisiensi
  if (processedMessageIds.size > 5000) {
    const firstKey = processedMessageIds.keys().next().value;
    processedMessageIds.delete(firstKey);
  }

  return false;
}

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
