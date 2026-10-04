import { db } from '@/src/core/database.js';

export default {
  "name": "leave",
  "description": "Leave current group",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      await sock.groupLeave(msg.key.remoteJid);
    },
};
