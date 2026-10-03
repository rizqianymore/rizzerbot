// plugins/owner/deluser.js — perintah "deluser" (SuperOwner saja).
// Hapus permanen 1 user dari database + cabut dari daftar peran.
// Primary owner tidak bisa dihapus. Tercatat di privilege-audit.json.
import { db } from '@/src/core/database.js';

export default {
  "name": "deluser",
  "aliases": ["hapususer", "removeuser"],
  "description": "Hapus permanen 1 user dari database",
  "usage": "<nomor>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] deluser oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Hapus user hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.deluser 628xx*");
      if (db.isPrimaryOwner(jid)) {
        return reply("❌ Nomor tersebut adalah Primary Owner dan tidak dapat dihapus!");
      }
      const ok = db.deleteUser(jid);
      if (!ok) return reply(`ℹ️ *${jid.split("@")[0]}* tidak ada di database.`);
      reply(`✅ User *${jid.split("@")[0]}* dihapus permanen dari database.`);
    },
};
