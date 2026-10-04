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
  "name": "sticker",
  "aliases": ["s","stiker"],
  "description": "Convert image/video to sticker (bisa tambahkan teks atas/bawah)",
  "usage": "[teks atas | bawah] (reply/kirim gambar)",
  "premiumOnly": true,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      const targetMsg = findDownloadableTarget(msg);

      if (!targetMsg) {
        return reply(
          "❌ Kirim atau balas gambar/video/GIF/stiker dengan caption:\n" +
          "• *.sticker* — ubah jadi stiker (video/GIF tetap bergerak)\n" +
          "• *.sticker Teks Atas | Teks Bawah* — stiker meme (bisa gambar & video)"
        );
      }

      let buffer = null;
      try {
        buffer = await getMediaBuffer(sock, targetMsg);
      } catch (err) {
        return reply(`❌ ${err?.message || "Gagal membaca media."}`);
      }
      if (!buffer) return reply("❌ Gagal membaca media. Pastikan mengirim atau membalas media berupa gambar, video, GIF, atau stiker.");

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
        const stickerBuffer = await createSticker(buffer, { topText, bottomText });
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
