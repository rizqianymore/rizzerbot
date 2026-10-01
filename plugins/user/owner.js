// plugins/user/owner.js — perintah "owner" (1 file = 1 perintah).
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
  "name": "owner",
  "aliases": ["ownerinfo","creator"],
  "description": "Get owner info",
  "usage": "",
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const activeSettings = db.getSettings();
      const ownerNumber = db.normalizeJid(activeSettings.ownerNumber).split("@")[0] || activeSettings.ownerNumber;
      const text =
        `👤 *OWNER INFO*\n\n` +
        `*Nama:* ${activeSettings.ownerName}\n` +
        `*Nomor:* wa.me/${ownerNumber}\n\n` +
        `Hubungi owner jika ada kendala / ingin sewa bot atau upgrade premium.`;
      await reply(text);
    },
};
