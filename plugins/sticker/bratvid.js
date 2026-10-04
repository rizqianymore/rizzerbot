import {
  TEMPLATES,
  createBratVideo,
  sendStickerBuffer,
  parseBratArgs,
  validateBratText,
} from "@/src/services/brat.js";

export default {
  "name": "bratvid",
  "aliases": ["bratvideo", "bratvid2"],
  "description": "Membuat stiker teks Brat video animasi teks berjalan",
  "usage": "<teks> [--green]",
  "premiumOnly": true,
  "category": "Sticker",
  "run": async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const { text, bgColor } = parseBratArgs(args, { allowVideo: false, allowGreen: true });
    if (!text) {
      return reply(`⚠️ Masukkan teks!\nContoh: \`${currentPrefix}bratvid lagu baru charli xcx\``);
    }

    const check = validateBratText(text, true);
    if (!check.ok) {
      return reply(check.error);
    }

    await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

    try {
      const videoBuffer = await createBratVideo(text, TEMPLATES.classic, { bgColor });
      await sendStickerBuffer(sock, msg, videoBuffer);
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      reply(`❌ Gagal membuat stiker Brat Video: ${err.message}`);
    }
  },
};
