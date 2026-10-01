// plugins/owner/public.js — perintah "public" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "public",
  "aliases": ["pub"],
  "description": "Set bot to public mode. Tambahkan --all untuk semua bot",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, botJid, senderJid, logger, isPrimarySuperOwner }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      // Verifikasi ganda independen: hanya owner bot INI yang boleh ubah modenya.
      if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
        logger?.warn?.(`[OwnerCmd] public DITOLAK untuk ${senderJid} via ${activeBotJid}`);
        return reply("❌ Perintah ini hanya untuk Owner bot ini!");
      }
      logger?.warn?.(`[OwnerCmd] public oleh ${senderJid} via ${activeBotJid}`);

      const syncAll = args.includes("--all") || args.includes("-a");
      if (syncAll && !isPrimarySuperOwner) {
        return reply("❌ Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
      }

      if (syncAll) {
        db.main().updateSettings({ public: true });
        const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
        const list = getSubBotsList();
        for (const b of list) {
          const sJid = `${b.number}@s.whatsapp.net`;
          db.updateBotSettings(sJid, { public: true });
        }
        reply("🌐 *MODE PUBLIC (SEMUA USER)* telah diaktifkan & disinkronkan untuk *SEMUA BOT*.");
      } else {
        db.updateBotSettings(activeBotJid, { public: true });
        reply(`🌐 Bot (+${activeBotJid.split('@')[0]}) sekarang dalam mode Public.`);
      }
    },
};
