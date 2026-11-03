import { db } from "@/src/core/database.js";

export default {
  name: "self",
  aliases: ["private", "modeprivate"],
  description: "Set bot to self/private mode (owner only). Alias dari public --private",
  usage: "[--all]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] self DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }

    const normalizedArgs = (args || []).map((a) => String(a).toLowerCase().trim());
    const syncAll = normalizedArgs.includes("--all") || normalizedArgs.includes("-a");

    if (syncAll && !isPrimarySuperOwner) {
      return reply("Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
    }

    logger?.warn?.(`[OwnerCmd] self oleh ${senderJid} via ${activeBotJid} syncAll=${syncAll}`);

    if (syncAll) {
      db.main().updateSettings({ public: false });
      const { getAllSubBotNumbers } = await import("@/src/services/system/subbot/subbot.js");
      const numbers = getAllSubBotNumbers();
      for (const number of numbers) {
        db.updateBotSettings(`${number}@s.whatsapp.net`, { public: false });
      }
      const total = numbers.length + 1;
      return reply(`*MODE SELF (OWNER ONLY)* telah diaktifkan & disinkronkan untuk *SEMUA BOT* (${total} bot).`);
    }

    db.updateBotSettings(activeBotJid, { public: false });
    return reply(`🔒 Bot (+${activeBotJid.split("@")[0]}) sekarang dalam mode *SELF/PRIVATE* (hanya owner).`);
  },
};
