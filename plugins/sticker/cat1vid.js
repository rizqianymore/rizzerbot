import { createCat1AnimatedSticker } from "@/src/services/fetch/brat/cat1-anim.js";
import { parseBratArgs, validateBratText, sendStickerBuffer } from "@/src/services/fetch/brat.js";

export default {
  name: "cat1vid",
  aliases: ["catvid", "stikercatvid", "kucingvid", "kucinggerak", "cat1gerak"],
  description: "Membuat stiker video animasi Kucing Cat 1 dengan telinga bergerak naik-turun dan teks kustom",
  usage: "[teks] [--green]",
  premiumOnly: false,
  cooldownMs: 5000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const { text, bgColor } = parseBratArgs(args, { allowVideo: true, allowGreen: true });

    if (text) {
      const check = validateBratText(text, true);
      if (!check.ok) {
        return reply(check.error);
      }
    }

    await sendTyping();

    try {
      const stickerBuffer = await createCat1AnimatedSticker(text || "", {
        bgColor,
      });

      await sendStickerBuffer(sock, msg, stickerBuffer);
    } catch (err) {
      logger?.error?.(`[cat1vid] ${err?.stack || err?.message || err}`);
      await reply(`Gagal membuat stiker animasi Cat 1: ${err.message || err}`);
    }
  },
};
