// plugins/premium/searchpro.js — perintah "searchpro" (1 file = 1 perintah).
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
  "name": "searchpro",
  "description": "Deep web search",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ");
      if (!query) return reply("❌ Masukkan kata kunci! Contoh: *.searchpro rizz bot*");
      await reply("🔍 Mencari...");
      try {
        const results = await webSearch(query);
        const text =
          results
            .map((r, i) => `${i + 1}. *${r.text}*\n${r.url || ""}`)
            .join("\n\n");
        await reply(`🔎 *Hasil Pencarian:*\n\n${text.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ Gagal mencari: ${err.message}`);
      }
    },
};
