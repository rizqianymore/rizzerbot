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
  "name": "quote",
  "description": "Get a random rizz quote",
  "usage": "",
  "premiumOnly": false,
  "category": "User",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quotes = [
        "Are you a magician? Because whenever I look at you, everyone else disappears.",
        "Do you have a map? I keep getting lost in your eyes.",
        "Are you a Wi-Fi signal? Because I'm feeling a really strong connection.",
        "Do you believe in love at first sight, or should I walk by again?",
        "Is your name Google? Because you have everything I've been searching for.",
        "If you were a triangle, you'd be acute one.",
        "Are you a camera? Because every time I look at you, I smile.",
        "We're not socks, but I think we'd make a great pair.",
        "Are you a keyboard? Because you're just my type.",
        "Did it hurt when you fell from the vending machine? Because you're a snack.",
        "Are you a bank loan? Because you have my interest.",
        "If looks could kill, you'd be a lethal weapon.",
        "Are you Netflix? Because I could watch you for hours.",
        "You must be a broom, because you just swept me off my feet.",
        "Are you a star? Because you light up my night sky.",
      ];
      await reply(`💘 _"${quotes[Math.floor(Math.random() * quotes.length)]}"_`);
    },
};
