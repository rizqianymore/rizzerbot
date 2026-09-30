// plugins/owner/deladmin.js — perintah "deladmin" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "deladmin",
  "description": "Hapus admin bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan Admin Bot hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.deladmin 628xx*");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat dihapus melalui perintah deladmin.");
      if (!db.isAdmin(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* bukan Admin Bot.`);

      db.setAdmin(jid, false);
      reply(`✅ Berhasil mencabut akses Admin Bot dari *${jid.split("@")[0]}*.`);
    },
};
