import {
  TEMPLATES,
  createBratImage,
  createBratVideo,
  sendStickerBuffer,
  showBratGuide,
  parseBratArgs,
  validateBratText,
} from "@/src/services/fetch/brat.js";

export default {
  name: "brat",
  aliases: ["bratimg", "brattext", "sbrat"],
  description: "Membuat stiker teks Brat Classic (lokal generator)",
  usage: "<teks> [--green] [--video]",
  premiumOnly: true,
  category: "Sticker",
  run: async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const { text, isVideo, bgColor } = parseBratArgs(args, { allowVideo: true, allowGreen: true });
    if (!text) {
      return reply(showBratGuide(currentPrefix));
    }

    const check = validateBratText(text, isVideo);
    if (!check.ok) {
      return reply(check.error);
    }


    try {
      if (isVideo) {
        const videoBuffer = await createBratVideo(text, TEMPLATES.classic, { bgColor });
        await sendStickerBuffer(sock, msg, videoBuffer);
      } else {
        const imageBuffer = await createBratImage(text, TEMPLATES.classic, { bgColor });
        await sendStickerBuffer(sock, msg, imageBuffer);
      }
    } catch (err) {
      reply(`Gagal membuat stiker Brat: ${err.message}`);
    }
  },
};
