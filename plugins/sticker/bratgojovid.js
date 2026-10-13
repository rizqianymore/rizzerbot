import {
  TEMPLATES,
  createBratVideo,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

export default {
  name: "bratgojovid",
  aliases: ["sbratgojovid"],
  description: "Membuat stiker Brat Gojo video animasi berjalan",
  usage: "<teks>",
  premiumOnly: true,
  category: "Sticker",
  run: async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const { text } = parseBratArgs(args);
    if (!text) {
      return reply(`Harap masukkan teksnya!\nContoh: \`${currentPrefix}bratgojovid Halo semuanya\``);
    }

    const check = validateBratText(text, true);
    if (!check.ok) {
      return reply(check.error);
    }


    try {
      const videoBuffer = await createBratVideo(text, TEMPLATES.gojo);
      await sendStickerBuffer(sock, msg, videoBuffer);
    } catch (err) {
      reply(`Gagal membuat stiker Brat Gojo Video: ${err.message}`);
    }
  },
};
