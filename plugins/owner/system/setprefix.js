import { db } from "@/src/core/database.js";

export default {
  name: "setprefix",
  description: "Change bot prefix (opsional: tambahkan --all untuk semua bot)",
  usage: "<simbol>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] setprefix DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }
    logger?.warn?.(`[OwnerCmd] setprefix oleh ${senderJid} via ${activeBotJid}`);

    const syncAll = args.includes("--all") || args.includes("-a");
    const cleanArgs = args.filter((a) => a !== "--all" && a !== "-a");
    const prefix = cleanArgs[0] || "";

    if (!prefix || prefix.length > 3 || /\s/.test(prefix)) {
      return reply(
        "Prefix harus berupa 1-3 karakter tanpa spasi.\nContoh: `.setprefix !` atau `.setprefix ! --all` (sinkron ke semua bot)"
      );
    }

    if (syncAll && !isPrimarySuperOwner) {
      return reply("Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
    }

    if (syncAll) {
      db.main().updateSettings({ prefix });
      const { getAllSubBotNumbers } = await import("@/src/services/system/subbot/subbot.js");
      const numbers = getAllSubBotNumbers();
      for (const number of numbers) {
        db.updateBotSettings(`${number}@s.whatsapp.net`, { prefix });
      }
      reply(`Prefix berhasil diubah & disinkronkan ke semua bot (${numbers.length} bot): \`${prefix}\``);
    } else {
      db.updateBotSettings(activeBotJid, { prefix });
      reply(`Prefix berhasil diubah ke: \`${prefix}\` untuk bot ini (+${activeBotJid.split("@")[0]}).`);
    }
  },
};
