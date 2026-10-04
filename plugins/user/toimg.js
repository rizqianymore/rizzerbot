import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
  webpToVideo,
  findDownloadableTarget,
} from '@/src/services/media.js';

export default {
  "name": "toimg",
  "aliases": ["toimage", "tovid", "tovideo"],
  "description": "Convert sticker to image or video",
  "usage": "(reply stiker)",
  "premiumOnly": true,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const targetMsg = findDownloadableTarget(msg);
      let buffer = null;
      if (targetMsg) {
        try {
          buffer = await getMediaBuffer(sock, targetMsg);
        } catch (err) {
          return reply(`❌ ${err?.message || "Gagal membaca media."}`);
        }
      }
      if (!buffer) return reply("❌ Balas stiker dengan perintah *.toimg* atau *.tovid*");

      try {
        const vidBuffer = await webpToVideo(buffer);
        if (vidBuffer) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { video: vidBuffer, caption: "🎥 *HASIL KONVERSI STIKER KE VIDEO*" },
            { quoted: msg }
          );
          return;
        }

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
