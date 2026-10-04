import { db } from '@/src/core/database.js';

export default {
  "name": "delprem",
  "description": "Hapus pengguna premium",
  "usage": "<nomor>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delprem 628xx*");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat kehilangan akses Premium.");
      if (db.isAdmin(jid)) return reply("❌ Admin Bot otomatis memiliki akses Premium.");

      db.setPremium(jid, false);
      reply(`✅ Berhasil menghapus *${jid.split("@")[0]}* dari daftar Premium.`);
    },
};
