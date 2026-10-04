import { db } from '@/src/core/database.js';

export default {
  "name": "syncsubbot",
  "aliases": ["updatesubbot","syncbot"],
  "description": "Perbarui dan sinkronkan database serta pengaturan seluruh sub-bot yang ada di server",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] syncsubbot oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Fitur sinkronisasi server hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const { syncSubBotsDatabase, getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const count = await syncSubBotsDatabase();
      const activeList = getSubBotsList();
      await reply(
        `✅ *Sinkronisasi Database Sub-Bot Berhasil!*\n\n` +
        `📦 *Sub-Bot di Server:* ${count} bot disinkronkan\n` +
        `🟢 *Status Aktif:* ${activeList.filter((b) => b.status === "online").length} online / ${activeList.length} total\n` +
        `⚙️ *Pengaturan:* Data & konfigurasi masing-masing sub-bot telah diperbarui tanpa bentrok peran.`
      );
    },
};
