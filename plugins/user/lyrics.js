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
  "name": "lyrics",
  "aliases": ["lirik"],
  "description": "Search song lyrics",
  "usage": "<judul lagu>",
  "premiumOnly": true,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ");
      if (!query) return reply("❌ Masukkan judul lagu! Contoh: *.lyrics [penyanyi] [judul]*");
      const parts = query.split(" ");
      const artist = parts.slice(0, -1).join(" ") || "unknown";
      const title = parts[parts.length - 1];
      await reply("🔍 Mencari lirik...");
      try {
        const lyrics = await fetchLyrics(artist, title);
        await reply(`🎵 *Lirik: ${title}*\n\n${lyrics.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ Lirik tidak ditemukan. Pastikan format: *penyair judul*`);
      }
    },
};
