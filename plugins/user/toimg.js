// plugins/user/toimg.js — perintah "toimg" (1 file = 1 perintah).
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
  "name": "toimg",
  "aliases": ["toimage"],
  "description": "Convert sticker to image",
  "usage": "(reply stiker)",
  "premiumOnly": true,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const targetMsg = findDownloadableTarget(msg);
      let buffer = null;
      if (targetMsg) {
        buffer = await getMediaBuffer(sock, targetMsg);
      }
      if (!buffer) return reply("❌ Balas stiker dengan caption *\\.toimg*");
      try {
        const png = await webpToImage(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: png, caption: "🖼️ *HASIL KONVERSI STIKER KE GAMBAR*" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mengkonversi: ${err.message}`);
      }
    },
};
