// plugins/user/ping.js — perintah "ping" (1 file = 1 perintah).
import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
  findDownloadableTarget,
} from '@/src/services/media.js';
import {
  fetchLyrics,
  translateText,
} from '@/src/services/scrape.js';


import { getUptimeString } from '@/src/utils/helper.js';



export default {
  "name": "ping",
  "description": "Check bot speed",
  "usage": "",
  "category": "User",
  "run": async (sock, msg, args, { reply, senderJid, sendTyping }) => {
      await sendTyping();
      const start = Date.now();
      await sock.sendMessage(msg.key.remoteJid, { text: "⚡ Ping..." }, { quoted: msg });
      const speed = Date.now() - start;
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⚡ *PONG!*\nKecepatan: *${speed}ms*` },
        { quoted: msg }
      );
    },
};
