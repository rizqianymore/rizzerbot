// plugins/owner/cleartmp.js — perintah "cleartmp" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "cleartmp",
  "aliases": ["clearsampah","clearcache","purgetmp"],
  "description": "Bersihkan file sampah, cache sesi usang, dan log sementara",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, logger, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pembersihan cache dan sampah server hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      await reply("🧹 Sedang membersihkan file sampah dan cache sementara...");
      try {
        const { clearAllCache } = await import("@/src/utils/cleaner.js");
        const { deletedCount, freedBytes } = clearAllCache({ logger });
        const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
        await reply(
          `✅ *Pembersihan Semua Cache & Sampah Selesai!*\n\n` +
          `🗑️ *File dihapus:* ${deletedCount} file (cache, temp, dump, session keys)\n` +
          `💾 *Ruang dibebaskan:* ${freedMB} MB\n` +
          `⚡ *Renderer Chrome:* Dibersihkan (orphaned process killed)`
        );
      } catch (err) {
        await reply(`❌ Gagal membersihkan sampah: ${err.message}`);
      }
    },
};
