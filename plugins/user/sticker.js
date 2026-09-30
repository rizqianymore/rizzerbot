// plugins/user/sticker.js — perintah "sticker" (1 file = 1 perintah).
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
  "premiumOnly": false,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      const targetMsg = findDownloadableTarget(msg);

      if (!targetMsg) {
        return reply(
          "❌ Kirim/balas gambar atau video dengan caption:\n" +
          "• *.sticker* — langsung jadi stiker\n" +
          "• *.sticker Teks Atas | Teks Bawah* — stiker + teks meme"
        );
      }

      const buffer = await getMediaBuffer(sock, targetMsg);
      if (!buffer) return reply("❌ Gagal membaca media. Coba kirim ulang gambarnya (jangan forward dari View Once, kirim sebagai gambar biasa).");

      // Parse teks meme atas / bawah via format: teks atas | teks bawah
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
