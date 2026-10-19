import { db } from "@/src/core/database.js";
import { notifyPrimaryOwner } from "@/src/utils/notify-owner.js";

export default {
  name: "delowner",
  description: "Hapus owner tambahan dari bot",
  usage: "<nomor>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] delowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }
    logger?.warn?.(`[OwnerCmd] delowner oleh ${senderJid} via ${activeBotJid}`);

    const jid = getTargetJid(args);
    if (!jid) return reply("Balas pesan user atau masukkan nomor! Contoh: *.delowner 628xx*");

    if (db.isPrimaryOwner(jid)) {
      return reply("Nomor tersebut adalah Primary Owner (Pemilik Utama) dan tidak dapat dihapus!");
    }
    if (db.isAnyBotJid(jid)) {
      return reply("Nomor tersebut adalah nomor bot (sesi bot lain), bukan Owner.");
    }

    if (db.isConfigFileOwner(jid)) {
      return reply(
        `*${jid.split("@")[0]}* terdaftar di *config/settings.js* (ownerNumber/pairingNumber/ownerNumbers).\n` +
          `Status Owner-nya tidak bisa dicabut lewat chat. Hapus nomornya dari config lalu restart bot.`
      );
    }

    const isSub = Boolean(sock.isSubBot) || !db.isMainBotJid(activeBotJid);

    if (isSub) {
      const botConfig = db.getBotSettings(activeBotJid);
      const dedicatedOwner = db.normalizeJid(botConfig.ownerNumber);
      if (dedicatedOwner === jid) {
        return reply(
          `*${jid.split("@")[0]}* adalah *Owner tetap* bot ini dan tidak dapat dihapus.\n` +
            `Gunakan *.setowner <nomor> confirm* untuk memindahkan kepemilikan bot ini.`
        );
      }

      const curOwners = Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : [];
      const nextOwners = curOwners.filter((o) => db.normalizeJid(o) !== jid);
      if (nextOwners.length === curOwners.length) {
        return reply(`*${jid.split("@")[0]}* bukan Owner tambahan bot ini.`);
      }

      db.setOwner(jid, false, senderJid);

      await notifyPrimaryOwner(sock, {
        actor: senderJid,
        action: "delowner (sub-bot)",
        target: jid,
        botJid: activeBotJid,
      });
      return reply(`Berhasil mencabut status Owner bot ini dari *${jid.split("@")[0]}*.`);
    }

    if (!isPrimarySuperOwner) {
      logger?.warn?.(`[OwnerCmd] delowner bot utama DITOLAK (bukan superowner): ${senderJid}`);
      return reply("Mencabut Owner Bot Utama hanya dapat dilakukan oleh SuperOwner (Primary Owner).");
    }

    if (!db.isOwner(jid)) {
      return reply(`*${jid.split("@")[0]}* bukan Owner.`);
    }

    db.setOwner(jid, false, senderJid);

    if (db.isOwner(jid)) {
      logger?.error?.(`[OwnerCmd] delowner GAGAL melepas ${jid} (masih owner, kemungkinan sumber config)`);
      return reply(
        `Status Owner *${jid.split("@")[0]}* belum bisa dicabut (masih terdaftar di sumber konfigurasi).\n` +
          `Periksa *config/settings.js* lalu restart bot.`
      );
    }

    await notifyPrimaryOwner(sock, {
      actor: senderJid,
      action: "delowner (utama)",
      target: jid,
      botJid: activeBotJid,
    });
    reply(`Berhasil menghapus *${jid.split("@")[0]}* dari daftar Owner Bot.`);
  },
};
