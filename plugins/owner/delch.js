// plugins/owner/delch.js — perintah "delch" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "delch",
  "aliases": ["clearch","hapussaluran"],
  "description": "Hapus konfigurasi saluran resmi dari bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan saluran resmi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      db.main().updateSettings({ channelJid: "" });
      reply("✅ Konfigurasi Saluran bot berhasil dinonaktifkan/dihapus.");
    },
};
