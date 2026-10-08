import { db } from '@/src/core/database.js';

export default {
  "name": "join",
  "description": "Join group via link",
  "usage": "<link group>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      if (!args[0]) return reply("Masukkan link grup!");
      const { parseGroupInviteCode } = await import("@/src/services/bug/helpers.js");
      const code = parseGroupInviteCode(args[0]);
      if (!code) return reply("❌ Link grup tidak valid! Contoh: https://chat.whatsapp.com/xxxx");
      try {
        await sock.groupAcceptInvite(code);
      } catch (err) {
        return reply(`❌ Gagal bergabung: ${err?.message || err}`);
      }
      reply("✅ Berhasil bergabung.");
    },
};
