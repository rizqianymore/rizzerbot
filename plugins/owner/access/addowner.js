import { db } from "@/src/core/database.js";
import { notifyPrimaryOwner } from "@/src/utils/notify-owner.js";

const MAX_OWNER_PER_BOT = 10;

export default {
  name: "addowner",
  description: "Tambahkan owner baru ke bot",
  usage: "<nomor>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger, isPrimarySuperOwner }) => {
    const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

    if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
      logger?.warn?.(`[OwnerCmd] addowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
      return reply("Perintah ini hanya untuk Owner bot ini!");
    }
    logger?.warn?.(`[OwnerCmd] addowner oleh ${senderJid} via ${activeBotJid}`);

    const jid = getTargetJid(args);
    if (!jid) return reply("Balas pesan user atau masukkan nomor! Contoh: *.addowner 628xx*");

    if (!jid.endsWith("@s.whatsapp.net") || jid.split("@")[0].replace(/\D/g, "").length < 8) {
      logger?.warn?.(`[OwnerCmd] addowner target INVALID: ${jid} oleh ${senderJid}`);
      return reply("Target owner harus nomor WhatsApp asli!\nKetik manual nomornya, contoh: *.addowner 6281234567890*");
    }

    if (db.isAnyBotJid(jid)) {
      logger?.warn?.(`[OwnerCmd] addowner target adalah nomor bot: ${jid} oleh ${senderJid}`);
      return reply("Nomor tersebut adalah nomor bot (sesi bot lain) dan tidak bisa dijadikan Owner.");
    }

    if (db.isPrimaryOwner(jid)) {
      return reply(`*${jid.split("@")[0]}* sudah menjadi Primary Owner (SuperOwner).`);
    }

    try {
      const check = await sock.onWhatsApp(jid).catch(() => null);
      const exists = Array.isArray(check) && check.some((r) => r && r.exists);
      if (!exists) {
        logger?.warn?.(`[OwnerCmd] addowner nomor tidak terdaftar: ${jid} oleh ${senderJid}`);
        return reply(
          `Nomor *${jid.split("@")[0]}* tidak terdaftar di WhatsApp (atau gagal diverifikasi).\nPastikan nomornya benar lalu coba lagi.`
        );
      }
    } catch (_) {
      return reply("Gagal memverifikasi nomor ke WhatsApp. Coba lagi sebentar.");
    }

    const isSub = Boolean(sock.isSubBot) || !db.isMainBotJid(activeBotJid);
    const botConfig = db.getBotSettings(activeBotJid);

    if (isSub) {
      const curOwners = Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : [];
      if (db.isBotOwner(activeBotJid, jid)) {
        return reply(`*${jid.split("@")[0]}* sudah menjadi Owner bot ini.`);
      }
      if (curOwners.length >= MAX_OWNER_PER_BOT) {
        return reply(`Kuota Owner bot ini sudah penuh (maks ${MAX_OWNER_PER_BOT} owner tambahan).`);
      }

      db.updateBotSettings(activeBotJid, {
        ownerNumbers: [...new Set([...curOwners, jid])],
      });

      const via = `Owner khusus bot +${activeBotJid.split("@")[0]}`;
      await notifyPrimaryOwner(sock, {
        actor: senderJid,
        action: "addowner (sub-bot)",
        target: jid,
        botJid: activeBotJid,
        extra: via,
      });
      return reply(`Berhasil menambahkan *${jid.split("@")[0]}* sebagai ${via}.`);
    }

    if (!isPrimarySuperOwner) {
      logger?.warn?.(`[OwnerCmd] addowner bot utama DITOLAK (bukan superowner): ${senderJid}`);
      return reply("Menambah Owner Bot Utama hanya dapat dilakukan oleh SuperOwner (Primary Owner).");
    }

    const curOwners = Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : [];
    if (db.isOwner(jid)) return reply(`*${jid.split("@")[0]}* sudah menjadi Owner.`);
    if (curOwners.length >= MAX_OWNER_PER_BOT) {
      return reply(`Kuota Owner Bot Utama sudah penuh (maks ${MAX_OWNER_PER_BOT} owner tambahan).`);
    }

    db.setOwner(jid, true, senderJid);
    await notifyPrimaryOwner(sock, {
      actor: senderJid,
      action: "addowner (utama)",
      target: jid,
      botJid: activeBotJid,
      extra: "Nomor ini otomatis punya akses owner di SELURUH sub-bot.",
    });
    reply(
      `Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner Bot Utama.\n_Peringatan: akses owner ikut berlaku di semua sub-bot._`
    );
  },
};
