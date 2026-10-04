import { db } from '@/src/core/database.js';

export default {
  "name": "addowner",
  "description": "Tambahkan owner baru ke bot",
  "usage": "<nomor>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

      if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
        logger?.warn?.(`[OwnerCmd] addowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
        return reply("❌ Perintah ini hanya untuk Owner bot ini!");
      }
      logger?.warn?.(`[OwnerCmd] addowner oleh ${senderJid} via ${activeBotJid}`);
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addowner 628xx*");

      if (!jid.endsWith("@s.whatsapp.net") || jid.split("@")[0].replace(/\D/g, "").length < 8) {
        logger?.warn?.(`[OwnerCmd] addowner target INVALID: ${jid} oleh ${senderJid}`);
        return reply("❌ Target owner harus nomor WhatsApp asli!\nKetik manual nomornya, contoh: *.addowner 6281234567890*");
      }

      try {
        const check = await sock.onWhatsApp(jid).catch(() => null);
        const exists = Array.isArray(check) && check.some((r) => r && r.exists);
        if (!exists) {
          logger?.warn?.(`[OwnerCmd] addowner nomor tidak terdaftar: ${jid} oleh ${senderJid}`);
          return reply(`❌ Nomor *${jid.split("@")[0]}* tidak terdaftar di WhatsApp (atau gagal diverifikasi).\nPastikan nomornya benar lalu coba lagi.`);
        }
      } catch (_) {
        return reply("❌ Gagal memverifikasi nomor ke WhatsApp. Coba lagi sebentar.");
      }

      const isSub = Boolean(sock.isSubBot || (activeBotJid && activeBotJid !== db.normalizeJid(db.getSettings().ownerNumber)));

      if (isSub) {
        const curConfig = db.getBotSettings(activeBotJid);
        const curOwners = Array.isArray(curConfig.ownerNumbers) ? curConfig.ownerNumbers : [];
        if (db.isBotOwner(activeBotJid, jid)) {
          return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Owner bot ini.`);
        }
        db.updateBotSettings(activeBotJid, {
          ownerNumbers: [...new Set([...curOwners, jid])],
        });
        return reply(`👑 Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner khusus bot ini (+${activeBotJid.split("@")[0]}).`);
      }

      if (db.isOwner(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Owner.`);
      db.setOwner(jid, true);
      reply(`👑 Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner Bot Utama.`);
    },
};
