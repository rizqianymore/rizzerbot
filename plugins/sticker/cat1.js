import {
  TEMPLATES,
  createBratImage,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

export default {
  name: "cat1",
  aliases: ["bratcat1", "stikercat1", "kucing1"],
  description: "Membuat stiker Brat versi Kucing Cat 1 dengan font Brat (Arial Narrow)",
  usage: "[teks] [--green]",
  premiumOnly: false,
  cooldownMs: 3000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, logger }) => {
    const { text, bgColor } = parseBratArgs(args, { allowVideo: false, allowGreen: true });

    // Jika tanpa teks, kirim stiker polosan cat1
    const displayText = text || " ";

    const check = validateBratText(displayText, false);
    if (!check.ok) {
      return reply(check.error);
    }

    try {
      const imageBuffer = await createBratImage(displayText, TEMPLATES.cat1, { bgColor });
      await sendStickerBuffer(sock, msg, imageBuffer);
    } catch (err) {
      logger?.error?.(`[cat1] ${err?.stack || err?.message || err}`);
      await reply(`Gagal membuat stiker Cat 1: ${err.message || err}`);
    }
  },
};
