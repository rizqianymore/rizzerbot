import { db } from '@/src/core/database.js';

export default {
  "name": "broadcast",
  "aliases": ["bc"],
  "description": "Broadcast message",
  "usage": "<pesan>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      if (!args.length) return reply("Masukkan pesan!");
      let chats = Object.keys(await sock.groupFetchAllParticipating());
      for (let jid of chats) {
        await sock.sendMessage(jid, { text: `📢 *BROADCAST*\n\n${args.join(" ")}` });
      }
      reply(`✅ Broadcast terkirim ke ${chats.length} grup.`);
    },
};
