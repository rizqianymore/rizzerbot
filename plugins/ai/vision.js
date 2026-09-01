import { downloadMediaMessage } from "baileys";
import { analyzeImageVision } from "@/src/services/aiVisionVoice.js";

export default {
  name: "vision",
  aliases: ["aivision", "lihat", "analisis", "tanyafoto"],
  description: "Menganalisis dan menjelaskan isi gambar dengan AI Multi-Modal Vision.",
  usage: "<balas foto / kirim foto dengan caption>",
  example: "vision Jelaskan apa yang terjadi di foto ini",
  category: "AI",
  premiumOnly: true,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const prompt = args.join(" ").trim() || "Jelaskan gambar ini secara detail dan informatif dalam bahasa Indonesia.";
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    // Cek apakah pesan itu sendiri memiliki gambar atau me-reply gambar
    const isDirectImage = Boolean(msg.message?.imageMessage);
    const isQuotedImage = Boolean(quotedMsg?.imageMessage);

    if (!isDirectImage && !isQuotedImage) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `👁️ *AI Vision Multi-Modal Image Analyzer*\n\n` +
            `*Cara Penggunaan:*\n` +
            `1. Kirim foto dengan caption: \`${activePrefix}vision <pertanyaan>\`\n` +
            `2. Atau balas (*reply*) foto yang sudah ada dengan: \`${activePrefix}vision <pertanyaan>\`\n\n` +
            `*Contoh:* \`${activePrefix}vision Apa tulisan di gambar ini dan jelaskan maksudnya\``,
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    try {
      const targetMsg = isDirectImage ? msg : {
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage?.contextInfo?.stanzaId,
          participant: msg.message.extendedTextMessage?.contextInfo?.participant,
        },
        message: quotedMsg,
      };

      const imageBuffer = await downloadMediaMessage(
        targetMsg,
        "buffer",
        {},
        {
          logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      if (!imageBuffer || imageBuffer.length === 0) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal mengunduh gambar untuk dianalisis." },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "🧠 _Sedang menganalisis gambar dengan AI Multi-Modal Vision..._" },
        { quoted: msg }
      );

      const result = await analyzeImageVision(imageBuffer, prompt);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👁️ *HASIL ANALISIS AI VISION*\n\n${result}\n\n_🧠 Multi-Modal Vision Engine_`,
        },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal memproses gambar: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
