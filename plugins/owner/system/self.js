import { db } from "@/src/core/database.js";

export default {
  name: "self",
  description: "Set bot to self mode (owner only). Tambahkan --all untuk semua bot",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] self DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }
    logger?.warn?.(`[OwnerCmd] self oleh ${senderJid} via ${activeBotJid}`);

    const syncAll = args.includes("--all") || args.includes("-a");
    if (syncAll && !isPrimarySuperOwner) {
      return reply("Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
    }

    if (syncAll) {
      db.main().updateSettings({ public: false });
      const { getAllSubBotNumbers } = await import("@/src/services/system/subbot/subbot.js");
      const numbers = getAllSubBotNumbers();
      for (const number of numbers) {
        db.updateBotSettings(`${number}@s.whatsapp.net`, { public: false });
      }
      reply(`*MODE SELF (OWNER ONLY)* telah diaktifkan & disinkronkan untuk *SEMUA BOT* (${numbers.length} bot).`);
    } else {
      db.updateBotSettings(activeBotJid, { public: false });
      reply(`Bot (+${activeBotJid.split("@")[0]}) sekarang dalam mode Self.`);
    }
  },
};
