// plugins/premium/customprofile.js — perintah "customprofile" (1 file = 1 perintah).
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
  "name": "customprofile",
  "aliases": ["setprofile"],
  "description": "Set custom profile text",
  "usage": "<teks bio>",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid }) => {
      await sendTyping();
      const text = args.join(" ").trim();
      if (!text) return reply("❌ Masukkan teks profil! Contoh: *.customprofile CEO of Rizz*");
      db.updateUser(senderJid, { profile: text });
      await reply(`✅ Profil kustom diatur:\n\n"${text}"`);
    },
};
