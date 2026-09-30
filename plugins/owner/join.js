// plugins/owner/join.js — perintah "join" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "join",
  "description": "Join group via link",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      if (!args[0]) return reply("Masukkan link grup!");
      let code = args[0].split("chat.whatsapp.com/")[1];
      await sock.groupAcceptInvite(code);
      reply("✅ Berhasil bergabung.");
    },
};
