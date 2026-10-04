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
  "name": "tts",
  "description": "Text to speech (Google TTS)",
  "usage": "<teks>",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const text = args.join(" ");
      if (!text) return reply("❌ Masukkan teks! Contoh: *.tts halo dunia*");
      await reply("🗣️ Mengonversi teks ke suara...");
      try {
        const audio = await textToSpeech(text, "id-ID");
        await sock.sendMessage(
          msg.key.remoteJid,
          { audio, mimetype: "audio/mpeg", ptt: true },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal membuat suara: ${err.message}`);
      }
    },
};
