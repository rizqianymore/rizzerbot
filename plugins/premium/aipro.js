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
  "name": "aipro",
  "description": "AI Chat (GPT/Gemini)",
  "usage": "<prompt>",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const prompt = args.join(" ");
      if (!prompt) return reply("❌ Masukkan pertanyaan! Contoh: *.aipro apa itu rizz?*");
      await reply("🧠 Menganalisis...");
      try {
        const answer = await aiChat(prompt);
        await reply(`🤖 *AI ANSWER:*\n\n${answer.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ ${err.message}`);
      }
    },
};
