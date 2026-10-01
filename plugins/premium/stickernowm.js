// plugins/premium/stickernowm.js — perintah "stickernowm" (1 file = 1 perintah).
import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  upscaleImage,
  createSticker,
  findDownloadableTarget,
} from '@/src/services/media.js';
import {
  textToSpeech,
  searchAnime,
  webSearch,
  aiChat,
} from '@/src/services/scrape.js';



export default {
  "name": "stickernowm",
  "description": "Create sticker without watermark",
  "usage": "[teks atas | bawah] (reply gambar)",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const targetMsg = findDownloadableTarget(msg);
      const buffer = targetMsg ? await getMediaBuffer(sock, targetMsg) : null;
      if (!buffer) return reply("❌ Balas/buka gambar dengan caption *\\.stickernowm*");
      // Parse text meme atas / bawah
      let topText = "";
      let bottomText = "";
      if (args.length > 0) {
        const fullText = args.join(" ");
        if (fullText.includes("|")) {
          const parts = fullText.split("|");
          topText = parts[0]?.trim() || "";
          bottomText = parts.slice(1).join("|")?.trim() || "";
        } else {
          bottomText = fullText.trim();
        }
      }

      try {
        const stickerBuffer = await createSticker(buffer, { pack: "", author: "", topText, bottomText });
        await sock.sendMessage(
          msg.key.remoteJid,
          { sticker: stickerBuffer },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal membuat stiker: ${err.message}`);
      }
    },
};
