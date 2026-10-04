import {
  TEMPLATES,
  createBratVideo,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
  MAX_BRAT_VIDEO_LENGTH,
  MAX_BRAT_VIDEO_WORDS,
} from "@/src/services/brat.js";

export default {
  "name": "bratvermeilvid",
  "aliases": ["sbratvermeilvid"],
  "description": "Membuat stiker Brat Vermeil video animasi berjalan",
  "usage": "<teks>",
  "premiumOnly": true,
  "category": "Sticker",
  "run": async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const { text } = parseBratArgs(args);
    if (!text) {
      return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${currentPrefix}bratvermeilvid Halo semuanya\``);
    }

    const check = validateBratText(text, true);
    if (!check.ok) {
      return reply(
        `⚠️ Kalimat terlalu panjang! Maksimal ${MAX_BRAT_VIDEO_LENGTH} karakter dan ${MAX_BRAT_VIDEO_WORDS} kata untuk video Brat Vermeil.`
      );
    }

    await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

    try {
      const videoBuffer = await createBratVideo(text, TEMPLATES.vermeil);
      await sendStickerBuffer(sock, msg, videoBuffer);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      reply(`❌ Gagal membuat stiker Brat Vermeil Video: ${err.message}`);
    }
  },
};
