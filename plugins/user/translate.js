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
  "name": "translate",
  "aliases": ["tr"],
  "description": "Translate text (default: id)",
  "usage": "[kode_bahasa] <teks>",
  "premiumOnly": true,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const text = args.join(" ");
      if (!text) return reply("❌ Masukkan teks! Contoh: *.translate hello world*");
      try {
        const result = await translateText(text, "id");
        await reply(`✅ *TERJEMAHAN:*\n\n${result.translated}`);
      } catch (err) {
        await reply(`❌ Terjemahan gagal: ${err.message}`);
      }
    },
};
