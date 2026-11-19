import { getSubBotsList } from "@/src/services/system/subbot/subbot.js";
import { clearAllCache } from "@/src/utils/cleaner.js";

export default {
  name: "status",
  aliases: ["botstatus", "statsbot", "systemstatus", "stat", "serverstatus"],
  description: "Cek status sistem bot, atau bersihkan sampah/cache (.status clean)",
  usage: "[clean]",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, logger, isPrimarySuperOwner }) => {
    const subCmd = (args[0] || "").toLowerCase().trim();

    // 1. FITUR AUTO CLEAN / MANUAL CLEAN (.status clean)
    if (subCmd === "clean" || subCmd === "clear" || subCmd === "purge") {
      await sendTyping();
      await reply("Sedang membersihkan file sampah, cache sesi, dan proses menggantung...");
      try {
        const { deletedCount, freedBytes } = clearAllCache({ logger });
        const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);

        // Paksa Garbage Collection jika Node.js dijalankan dengan flag expose-gc
        if (typeof global.gc === "function") {
          global.gc();
        }

        const memAfter = process.memoryUsage();
        const rssAfterMB = (memAfter.rss / 1024 / 1024).toFixed(1);

        let out = `*PEMBERSIHAN SISTEM BERHASIL*\n`;
        out += `├─ File Dihapus : ${deletedCount} file cache/sampah\n`;
        out += `├─ Ruang Bebas  : ${freedMB} MB\n`;
        out += `├─ Chrome Proc  : Zombie renderer dibersihkan\n`;
        out += `└─ RAM Sekarang : ${rssAfterMB} MB`;

        return reply(out);
      } catch (err) {
        return reply(`Gagal membersihkan sistem: ${err.message}`);
      }
    }

    // 2. STATUS SISTEM BIASA (.status)
    await sendTyping();

    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
    const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

    const activeSubBots = getSubBotsList().length;

    let text = `*STATUS SISTEM BOT*\n`;
    text += `├─ Status       : ONLINE\n`;
    text += `├─ Uptime       : ${hours}j ${minutes}m ${seconds}s\n`;
    text += `├─ RAM RSS      : ${rssMB} MB\n`;
    text += `├─ Heap Memory  : ${heapUsedMB} MB / ${heapTotalMB} MB\n`;
    text += `├─ Sub-Bot Aktif: ${activeSubBots} bot\n`;
    text += `├─ Node.js      : ${process.version}\n`;
    text += `└─ Auto-Clean   : Aktif (Ketik .status clean untuk bersihkan)`;

    return reply(text);
  },
};
