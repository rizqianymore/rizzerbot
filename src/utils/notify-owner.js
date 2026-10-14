import { db } from "@/src/core/database.js";

/**
 * Notifikasi ke Primary Owner saat ada perubahan hak akses sensitif
 * (tambah/cabut owner, transfer owner, reset db, dll).
 *
 * Prinsip:
 * - gagal kirim tidak boleh menggagalkan perintah aslinya (selalu try/catch),
 * - tidak pernah mengirim notifikasi ke akun pelaku sendiri,
 * - ada cooldown per kombinasi aksi supaya tidak jadi spam.
 */

const COOLDOWN_MS = 60 * 1000;
const lastSent = new Map();

function digitsOf(jid) {
  return String(jid || "").split("@")[0] || "-";
}

function pruneCache(now) {
  if (lastSent.size < 200) return;
  for (const [key, at] of lastSent.entries()) {
    if (now - at > COOLDOWN_MS * 5) lastSent.delete(key);
  }
}

export async function notifyPrimaryOwner(sock, { actor, action, target, botJid, extra = "" }) {
  try {
    if (!sock?.sendMessage) return false;

    const ownerJid = db.normalizeJid(db.main().getSettings()?.ownerNumber);
    if (!ownerJid) return false;
    if (ownerJid === actor) return false;

    const now = Date.now();
    const key = `${actor}|${action}|${target}`;
    if (now - (lastSent.get(key) || 0) < COOLDOWN_MS) return false;
    lastSent.set(key, now);
    pruneCache(now);

    const lines = [
      "*🔐 PERUBAHAN HAK OWNER*",
      `Aksi : *${action}*`,
      `Oleh : ${digitsOf(actor)}`,
      `Target: ${digitsOf(target)}`,
      `Via  : bot +${digitsOf(botJid)}`,
    ];
    if (extra) lines.push(`\n${extra}`);

    await sock.sendMessage(ownerJid, { text: lines.join("\n") });
    return true;
  } catch (_) {
    return false;
  }
}
