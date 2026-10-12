import { db } from '@/src/core/database.js';

export default {
  "name": "delowner",
  "description": "Hapus owner tambahan dari bot",
  "usage": "<nomor>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

      if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
        logger?.warn?.(`[OwnerCmd] delowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
        return reply("❌ Perintah ini hanya untuk Owner bot ini!");
      }
      logger?.warn?.(`[OwnerCmd] delowner oleh ${senderJid} via ${activeBotJid}`);
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delowner 628xx*");
      if (db.isPrimaryOwner(jid)) {
        return reply("❌ Nomor tersebut adalah Primary Owner (Pemilik Utama) dan tidak dapat dihapus!");
      }

      const isSub = Boolean(sock.isSubBot || (activeBotJid && activeBotJid !== db.normalizeJid(db.getSettings().ownerNumber)));

      if (isSub) {
        const curConfig = db.getBotSettings(activeBotJid);
        const curOwners = Array.isArray(curConfig.ownerNumbers) ? curConfig.ownerNumbers : [];
        const nextOwners = curOwners.filter((o) => db.normalizeJid(o) !== jid);
        db.updateBotSettings(activeBotJid, { ownerNumbers: nextOwners });
        return reply(`✅ Berhasil mencabut status Owner bot ini dari *${jid.split("@")[0]}*.`);
      }

      if (!db.isOwner(jid)) {
        return reply(`ℹ️ *${jid.split("@")[0]}* bukan Owner.`);
      }

      db.setOwner(jid, false);
      reply(`✅ Berhasil menghapus *${jid.split("@")[0]}* dari daftar Owner Bot.`);
    },
};
