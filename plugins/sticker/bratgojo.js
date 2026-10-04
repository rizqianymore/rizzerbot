import {
  TEMPLATES,
  createBratImage,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
  MAX_BRAT_STATIC_LENGTH,
} from "@/src/services/brat.js";

export default {
  "name": "bratgojo",
  "aliases": ["sbratgojo"],
  "description": "Membuat stiker Brat versi Gojo Satoru",
  "usage": "<teks>",
  "premiumOnly": true,
  "category": "Sticker",
  "run": async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const { text } = parseBratArgs(args);
    if (!text) {
      return reply(`⚠️ Harap masukkan teksnya!\nContoh: \`${currentPrefix}bratgojo Halo semuanya\``);
    }

    const check = validateBratText(text, false);
    if (!check.ok) {
      return reply(`⚠️ Teks terlalu panjang! Maksimal ${MAX_BRAT_STATIC_LENGTH} karakter untuk stiker Brat Gojo.`);
    }

    await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

    try {
      const imageBuffer = await createBratImage(text, TEMPLATES.gojo);
      await sendStickerBuffer(sock, msg, imageBuffer);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      reply(`❌ Gagal membuat stiker Brat Gojo: ${err.message}`);
    }
  },
};
