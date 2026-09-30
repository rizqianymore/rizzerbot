// plugins/owner/botstatus.js — perintah "botstatus" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "botstatus",
  "aliases": ["statsbot","systemstatus"],
  "description": "Cek status kesehatan dan penggunaan memori bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      const mem = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
      const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

      const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const activeSubBots = getSubBotsList().length;

      const text =
        `⚙️ *Status Sistem*\n\n` +
        `• Uptime: ${hours}j ${minutes}m ${seconds}s\n` +
        `• RAM RSS: ${rssMB} MB\n` +
        `• Heap: ${heapUsedMB} MB / ${heapTotalMB} MB\n` +
        `• Primary Bot: 🟢 Online\n` +
        `• Sub-Bot Aktif: ${activeSubBots} bot\n` +
        `• Node.js: ${process.version}`;
      reply(text);
    },
};
