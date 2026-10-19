import {
  TEMPLATES,
  createBratImage,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

export default {
  name: "bratvermeil",
  aliases: ["sbratvermeil"],
  description: "Membuat stiker Brat versi Vermeil",
  usage: "<teks>",
  premiumOnly: true,
  category: "Sticker",
  run: async (sock, msg, args, { reply, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const { text } = parseBratArgs(args);
    if (!text) {
      return reply(`Harap masukkan teksnya!\nContoh: \`${currentPrefix}bratvermeil Halo semuanya\``);
    }

    const check = validateBratText(text, false);
    if (!check.ok) {
      return reply(check.error);
    }

    try {
      const imageBuffer = await createBratImage(text, TEMPLATES.vermeil);
      await sendStickerBuffer(sock, msg, imageBuffer);
    } catch (err) {
      logger?.error?.(`[bratvermeil] ${err?.stack || err?.message || err}`);
      reply(`Gagal membuat stiker Brat Vermeil: ${err.message}`);
    }
  },
};
