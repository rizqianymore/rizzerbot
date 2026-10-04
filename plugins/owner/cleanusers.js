import { db } from '@/src/core/database.js';

function findJunk(users, inactiveDays) {
  const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
  const out = [];
  for (const [jid, u] of Object.entries(users || {})) {
    if (!jid.endsWith("@s.whatsapp.net")) continue;
    if (!u || u.owner || u.admin || u.premium || u.registered || u.banned) continue;
    const last = Number(u.lastSeen || u.createdAt || 0);
    if (last && last < cutoff) out.push(jid);
  }
  return out;
}

export default {
  "name": "cleanusers",
  "aliases": ["cleanuser", "hapusampah", "pruneusers"],
  "description": "Bersihkan user tak aktif & tak terdaftar dari database",
  "usage": "[hari] [confirm]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] cleanusers oleh ${senderJid} args=${args.join(" ")}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Bersih-bersih database hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      let days = 30;
      for (const a of args) {
        const n = Number(a);
        if (Number.isFinite(n) && n >= 1 && n <= 3650) { days = Math.floor(n); break; }
      }
      const confirm = args.some((a) => ["confirm", "ya", "yes"].includes(String(a).toLowerCase()));
      const junk = findJunk(db.data.users, days);

      if (!confirm) {
        return reply(
          `🧹 *BERSIHKAN USER SAMPAH*\n\n` +
          `Kriteria: tak terdaftar, tanpa hak, tak aktif > ${days} hari.\n` +
          `Ditemukan: *${junk.length} user*\n` +
          (junk.length ? `Contoh: ${junk.slice(0, 5).map((j) => `+${j.split("@")[0]}`).join(", ")}${junk.length > 5 ? ` (+${junk.length - 5} lagi)` : ""}\n` : ``) +
          `\n_Ketik *.cleanusers ${days} confirm* untuk hapus._`
        );
      }

      await sendTyping();
      let deleted = 0;
      for (const jid of junk) {
        try {
          if (db.deleteUser(jid)) deleted++;
        } catch (_) {}
      }
      logger?.warn?.(`[OwnerCmd] cleanusers DIEKSEKUSI oleh ${senderJid}: ${deleted}/${junk.length} dihapus (>${days} hari)`);
      reply(`✅ *Bersih-bersih selesai:* ${deleted} user sampah dihapus (tak aktif > ${days} hari).`);
    },
};
