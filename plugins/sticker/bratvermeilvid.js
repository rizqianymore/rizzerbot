import {
  TEMPLATES,
  createBratVideo,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

export default {
  name: "bratvermeilvid",
  aliases: ["sbratvermeilvid"],
  description: "Membuat stiker Brat Vermeil video animasi berjalan",
  usage: "<teks>",
  premiumOnly: true,
  category: "Sticker",
  run: async (sock, msg, args, { reply, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const { text } = parseBratArgs(args);
    if (!text) {
      return reply(`Harap masukkan teksnya!\nContoh: \`${currentPrefix}bratvermeilvid Halo semuanya\``);
    }

    const check = validateBratText(text, true);
    if (!check.ok) {
      return reply(check.error);
    }

    try {
      const videoBuffer = await createBratVideo(text, TEMPLATES.vermeil);
      await sendStickerBuffer(sock, msg, videoBuffer);
    } catch (err) {
      logger?.error?.(`[bratvermeilvid] ${err?.stack || err?.message || err}`);
      reply(`Gagal membuat stiker Brat Vermeil Video: ${err.message}`);
    }
  },
};
