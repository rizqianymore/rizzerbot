// plugins/owner/eval.js — perintah "eval" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "eval",
  "description": "Evaluate javascript code",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, senderJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] eval oleh ${senderJid}`);
      if (!isPrimarySuperOwner) {
        return reply("❌ Perintah evaluasi kode hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      if (!args.length) return reply("Masukkan kode!");
      try {
        let evaled = await eval(args.join(" "));
        if (typeof evaled !== "string") evaled = await import("util").then(u => u.inspect(evaled));
        reply(evaled);
      } catch (err) {
        reply(String(err));
      }
    },
};
