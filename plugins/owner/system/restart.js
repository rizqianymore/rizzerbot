import { db } from '@/src/core/database.js';

export default {
  "name": "restart",
  "aliases": ["reboot"],
  "description": "Restart proses bot",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] restart oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Restart proses server hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      await reply("🔄 Merestart bot... Mohon tunggu beberapa saat.");
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    },
};
