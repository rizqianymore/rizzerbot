// plugins/owner/addadmin.js — perintah "addadmin" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "addadmin",
  "description": "Tambahkan admin bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan Admin Bot hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addadmin 628xx*");
      if (db.isOwner(jid)) return reply("ℹ️ Nomor tersebut sudah menjadi Owner (memiliki hak di atas Admin).");
      if (db.isAdmin(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Admin Bot.`);

      db.setAdmin(jid, true);
      reply(`🛡️ Berhasil menjadikan *${jid.split("@")[0]}* sebagai Admin Bot.`);
    },
};
