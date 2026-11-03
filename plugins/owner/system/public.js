import { db } from "@/src/core/database.js";

export default {
  name: "public",
  aliases: ["pub"],
  description: "Set bot to public mode (bisa diakses semua orang). Gunakan --private untuk private, --all untuk semua bot",
  usage: "[--private] [--all]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id || "");
    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] public DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }

    const normalizedArgs = (args || []).map((a) => String(a).toLowerCase().trim());
    const syncAll = normalizedArgs.includes("--all") || normalizedArgs.includes("-a");
    const wantPrivate = normalizedArgs.includes("--private") || normalizedArgs.includes("--self") || normalizedArgs.includes("-p");

    if (syncAll && !isPrimarySuperOwner) {
      return reply("Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
    }

    // Tanpa argumen -> tampilkan status saja (tidak mengubah)
    if (normalizedArgs.length === 0) {
      const cur = db.getBotSettings(activeBotJid)?.public;
      const current = cur === false ? "private (self)" : "public";
      return reply(
        `Mode saat ini: *${current}*\n` +
          `Gunakan:\n` +
          `• \`.public\` → public bot ini\n` +
          `• \`.public --private\` → private/self bot ini\n` +
          `• \`.public --all\` → public SEMUA bot\n` +
          `• \`.public --private --all\` → private SEMUA bot`
      );
    }

    const targetPublic = !wantPrivate;
    logger?.warn?.(`[OwnerCmd] public ${targetPublic ? "PUBLIC" : "SELF/PRIVATE"} oleh ${senderJid} via ${activeBotJid} syncAll=${syncAll}`);

    if (syncAll) {
      db.main().updateSettings({ public: targetPublic });
      const { getAllSubBotNumbers } = await import("@/src/services/system/subbot/subbot.js");
      const numbers = getAllSubBotNumbers();
      for (const number of numbers) {
        db.updateBotSettings(`${number}@s.whatsapp.net`, { public: targetPublic });
      }
      const modeLabel = targetPublic ? "PUBLIC" : "SELF (PRIVATE)";
      const total = numbers.length + 1;
      return reply(`*MODE ${modeLabel}* telah diaktifkan & disinkronkan untuk *SEMUA BOT* (${total} bot).`);
    }

    db.updateBotSettings(activeBotJid, { public: targetPublic });
    if (targetPublic) {
      return reply(`✅ Bot (+${activeBotJid.split("@")[0]}) sekarang mode *PUBLIC* (semua orang bisa chat)`);
    }
    return reply(`🔒 Bot (+${activeBotJid.split("@")[0]}) sekarang mode *PRIVATE/SELF* (hanya owner)`);
  },
};
