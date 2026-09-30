// plugins/premium/statspro.js — perintah "statspro" (1 file = 1 perintah).
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
  "name": "statspro",
  "description": "Detailed command statistics",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const usage = db.data.usage || {};
      const total = Object.values(usage).reduce((a, b) => a + b, 0);
      const top = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 10);
      let text =
        `📊 *Statistik Penggunaan Bot*\n\n` +
        `*Total Perintah:* ${total}\n` +
        `*Jumlah Fitur:* ${Object.keys(usage).length}\n\n` +
        `*Top 10 Command:*\n`;
      top.forEach(([cmd, count], i) => {
        text += ` ${i + 1}. ${cmd}: ${count}x\n`;
      });
      await reply(text);
    },
};
