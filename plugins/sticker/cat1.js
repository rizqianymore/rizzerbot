import path from "path";
import {
  TEMPLATES,
  createBratImage,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

const CAT1_TEMPLATE = TEMPLATES?.cat1 || {
  localPath: path.join(process.cwd(), "assets", "brat", "cat1.png"),
  width: 715,
  height: 720,
  safeZone: { a: 540, b: 685, c: 45, d: 670 },
  stroke: true,
  align: "center",
};

export default {
  name: "cat1",
  aliases: ["bratcat1", "stikercat1", "kucing1"],
  description: "Membuat stiker Brat versi Kucing Cat 1 dengan font Brat (Arial Narrow)",
  usage: "[teks] [--green]",
  premiumOnly: false,
  cooldownMs: 3000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const { text, bgColor } = parseBratArgs(args, { allowVideo: false, allowGreen: true });

    const displayText = text || " ";

    const check = validateBratText(displayText, false);
    if (!check.ok) {
      return reply(check.error);
    }

    await sendTyping();

    try {
      const template = TEMPLATES?.cat1 || CAT1_TEMPLATE;
      const imageBuffer = await createBratImage(displayText, template, {
        bgColor,
        align: template.align || "center",
      });
      await sendStickerBuffer(sock, msg, imageBuffer);
    } catch (err) {
      logger?.error?.(`[cat1] ${err?.stack || err?.message || err}`);
      await reply(`Gagal membuat stiker Cat 1: ${err.message || err}`);
    }
  },
};
