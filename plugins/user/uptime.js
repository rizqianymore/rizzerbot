import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
  findDownloadableTarget,
} from '@/src/services/fetch/media.js';
import {
  fetchLyrics,
  translateText,
} from '@/src/services/network/scrape.js';

import { getUptimeString } from '@/src/utils/helper.js';

export default {
  "name": "uptime",
  "description": "Check how long the bot has been running",
  "usage": "",
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      await reply(`⏳ *UPTIME:* ${getUptimeString()}`);
    },
};
