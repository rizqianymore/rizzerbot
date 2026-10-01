// plugins/owner/delbot.js — perintah "delbot" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "delbot",
  "aliases": ["stopbot","removebot"],
  "description": "Hentikan dan hapus sub-bot",
  "usage": "<nomor bot>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, isPrimarySuperOwner, senderJid, logger }) => {
      logger?.warn?.(`[OwnerCmd] delbot oleh ${senderJid} target=${args[0]}`);
      const target = args[0]?.replace(/[^0-9]/g, "");
      if (!target) return reply("❌ Masukkan nomor bot yang ingin dihapus! Contoh: *.delbot 628xxx*");

      const targetJid = `${target}@s.whatsapp.net`;

      // Jika bukan SuperOwner utama, verifikasi bahwa pemanggil adalah owner dari bot target tersebut
      if (!isPrimarySuperOwner) {
        const isOwnerOfTarget = db.isBotOwner(targetJid, senderJid);
        if (!isOwnerOfTarget) {
          return reply("❌ Anda hanya dapat mematikan dan menghapus bot milik Anda sendiri!");
        }
      }

      try {
        const { stopSubBot } = await import("@/src/services/subbot/subbot.js");
        await stopSubBot(target);
        reply(`✅ Sub-bot *+${target}* berhasil dimatikan dan dihapus dari sesi.`);
      } catch (err) {
        reply(`❌ Gagal menghapus sub-bot: ${err.message}`);
      }
    },
};
