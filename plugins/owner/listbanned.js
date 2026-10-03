// plugins/owner/listbanned.js — perintah "listbanned" (SuperOwner saja).
// Tampilkan semua nomor yang di-banned beserta namanya.
import { db } from '@/src/core/database.js';

export default {
  "name": "listbanned",
  "aliases": ["bannedlist", "daftarblokir"],
  "description": "Lihat daftar user yang dibanned",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] listbanned oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Daftar banned hanya dapat dilihat oleh SuperOwner Bot Utama.");
      }
      const banned = Object.entries(db.data.users || {})
        .filter(([jid, u]) => jid.endsWith("@s.whatsapp.net") && u?.banned && !u?.owner);
      if (!banned.length) return reply("✅ Tidak ada user yang dibanned.");
      const lines = [`🚫 *DAFTAR BANNED (${banned.length})*\n`];
      banned.slice(0, 50).forEach(([jid, u], i) => {
        lines.push(`${i + 1}. +${jid.split("@")[0]}${u.name ? ` (${u.name})` : ""}`);
      });
      if (banned.length > 50) lines.push(`_... dan ${banned.length - 50} lagi._`);
      lines.push(`\n_Unban 1 nomor: .unblock <nomor> | unban semua: .unbanall confirm_`);
      reply(lines.join("\n"));
    },
};
