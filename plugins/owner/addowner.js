// plugins/owner/addowner.js — perintah "addowner" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "addowner",
  "description": "Tambahkan owner baru ke bot",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid, botJid, senderJid, logger }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      // Verifikasi ganda: hanya owner bot INI yang boleh tambah owner.
      if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
        logger?.warn?.(`[OwnerCmd] addowner DITOLAK untuk ${senderJid} via ${activeBotJid}`);
        return reply("❌ Perintah ini hanya untuk Owner bot ini!");
      }
      logger?.warn?.(`[OwnerCmd] addowner oleh ${senderJid} via ${activeBotJid}`);
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addowner 628xx*");
      
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
