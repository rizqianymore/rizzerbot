// plugins/owner/leave.js — perintah "leave" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "leave",
  "description": "Leave current group",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply }) => {
      await sock.groupLeave(msg.key.remoteJid);
    },
};
