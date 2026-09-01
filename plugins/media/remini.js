import { downloadMediaMessage } from "baileys";
import sharp from "sharp";

/**
 * @credit: ren-offc & Kyros-MD
 * @noted: AI Image Upscaler / Remini Engine
 */
async function photoihancer(imageBuffer, method = 1) {
  // Pastikan format gambar adalah JPEG terstandarisasi sebelum dikirim ke API
  const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 95 }).toBuffer();
  const blob = new Blob([jpegBuffer], { type: "image/jpeg" });

  const form = new FormData();
  form.set("method", String(method));
  form.set("is_pro_version", "true");
  form.set("is_enhancing_more", "false");
  form.set("max_image_size", "high");
  form.set("file", blob, "file.jpg");

  const res = await fetch("https://ihancer.com/api/enhance", {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      Referer: "https://ihancer.com/app/",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Server enhancement error: ${res.status} ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export default {
  name: "remini",
  aliases: ["hd", "enhance", "upscale", "hdr", "jernihkan"],
  description: "Meningkatkan resolusi dan menjernihkan foto menjadi HD (Remini Engine).",
  usage: "<balas foto / kirim foto dengan caption>",
  example: "remini",
  category: "Media",
  premiumOnly: true,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isDirectImage = Boolean(msg.message?.imageMessage);
    const isQuotedImage = Boolean(quotedMsg?.imageMessage);

    if (!isDirectImage && !isQuotedImage) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `✨ *AI Photo Enhancer & Remini HD*\n\n` +
            `*Cara Penggunaan:*\n` +
            `1. Kirim foto dengan caption: \`${activePrefix}remini\`\n` +
            `2. Atau balas (*reply*) foto yang sudah ada dengan: \`${activePrefix}hd\`\n\n` +
            `💡 *Metode Opsional:* Tambahkan angka metode \`1\` atau \`2\` (Contoh: \`${activePrefix}remini 2\`)`,
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    try {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⏳ _Sedang memproses dan menjernihkan gambar menjadi HD..._" },
        { quoted: msg }
      );

      const targetMsg = isDirectImage
        ? msg
        : {
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
          { text: "❌ Gagal mengunduh foto untuk diproses." },
          { quoted: msg }
        );
      }

      const method = args[0] && ["1", "2"].includes(args[0]) ? parseInt(args[0], 10) : 1;
      const enhancedBuffer = await photoihancer(imageBuffer, method);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: enhancedBuffer,
          caption:
            `✅ *BERHASIL DIJERNIHKAN (HD)*\n\n` +
            `• *Engine:* Remini AI Pro\n` +
            `• *Kualitas:* Ultra High Resolution\n` +
            `• *Metode:* ${method}`,
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[Remini Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Gagal menjernihkan gambar: ${err.message || "Server scraper sibuk, coba beberapa saat lagi."}`,
        },
        { quoted: msg }
      );
    }
  },
};
