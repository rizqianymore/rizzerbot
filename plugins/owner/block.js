// plugins/owner/block.js — perintah "block" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "block",
  "description": "Block user",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor!");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat diblokir.");
      await sock.updateBlockStatus(jid, "block");
      db.setBanned(jid, true);
      reply(`✅ *${jid.split("@")[0]}* diblokir.`);
    },
};
