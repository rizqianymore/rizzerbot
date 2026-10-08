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
      if (!args.length) return reply("❌ Masukkan teks! Contoh: *.translate hello world* atau *.translate en halo dunia*");
      let lang = "id";
      let text = args.join(" ");
      if (args.length >= 2 && /^[a-z]{2}([-_][A-Za-z]{2})?$/.test(args[0])) {
        lang = args[0].toLowerCase().replace("_", "-");
        text = args.slice(1).join(" ");
      }
      if (!text) return reply("❌ Masukkan teks! Contoh: *.translate hello world*");
      try {
        const result = await translateText(text, lang);
        await reply(`✅ *TERJEMAHAN:*\n\n${result.translated}`);
      } catch (err) {
        await reply(`❌ Terjemahan gagal: ${err.message}`);
      }
    },
};
