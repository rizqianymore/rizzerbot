import { createCanvas } from "canvas";
import {
  tokenize,
  loadEmojiImages,
  measureTokensWidth,
  drawTokens,
  wrapTextEmoji,
  drawTokensJustified,
} from "@/lib/emojiHelper.js";

export default {
  premiumOnly: true,
  description: "Membuat stiker teks bergaya Brat.",
  usage: "<teks>",
  example: "Kyros-MD",
  name: "brat",
  aliases: ["bratmaker", "brats"],
  category: "Media",
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const text = args.join(" ");
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tentukan teks. Contoh: *.brat apel*" },
        { quoted: msg },
      );
      return;
    }

    if (text.length > 100) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Maksimal 100 karakter diperbolehkan." },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    try {
      const tempCanvas = createCanvas(256, 256);
      const tempCtx = tempCanvas.getContext("2d");

      tempCtx.fillStyle = "#ffffff";
      tempCtx.fillRect(0, 0, 256, 256);

      const words = text.split(" ");

      const allEmojis = [];
      for (const word of words) {
        const tokens = tokenize(word);
        for (const t of tokens) {
          if (t.type === "emoji") {
            allEmojis.push(t.value);
          }
        }
      }
      const emojiImages = await loadEmojiImages(allEmojis);

      tempCtx.fillStyle = "#000000";
      tempCtx.textBaseline = "top";
      let fontSize = 50;
      const paddingLeft = 14;
      const paddingTop = 18;
      const maxTextWidth = 256 - paddingLeft * 2;
      const maxTextHeight = 256 - paddingTop - 18;

      let lines = [];
      let lineHeight = 0;
      while (fontSize > 10) {
        tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;
        lineHeight = fontSize * 1.05;
        lines = wrapTextEmoji(tempCtx, text, maxTextWidth, fontSize);
        const totalHeight = lines.length * lineHeight;

        let wordFits = true;
        for (const word of words) {
          const wordTokens = tokenize(word);
          const wordWidth = measureTokensWidth(tempCtx, wordTokens, fontSize);
          if (wordWidth > maxTextWidth) {
            wordFits = false;
            break;
          }
        }

        if (wordFits && totalHeight <= maxTextHeight) {
          break;
        }
        fontSize -= 1;
      }

      tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;

      let startY = paddingTop;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isLastLine = i === lines.length - 1;
        drawTokensJustified(
          tempCtx,
          line,
          paddingLeft,
          startY,
          maxTextWidth,
          fontSize,
          emojiImages,
          isLastLine,
        );
        startY += lineHeight;
      }

      const canvas = createCanvas(512, 512);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tempCanvas, 0, 0, 512, 512);

      let buffer = canvas.toBuffer("image/png");

      try {
        const { addStickerMetadata } = await import("@/lib/stickerMetadata.js");
        const { settings } = await import("@/config/settings.js");
        const extractedEmojis = [...new Set(allEmojis)];
        const emojiParam =
          extractedEmojis.length > 0 ? extractedEmojis : undefined;
        buffer = await addStickerMetadata(
          buffer,
          settings.stickerPackName,
          settings.stickerAuthor,
          false,
          emojiParam,
        );
      } catch (metaErr) {
        console.error("Failed to add metadata for brat sticker:", metaErr);
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { sticker: buffer, mimetype: "image/webp" },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Local Brat generator error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Gagal membuat stiker Brat lokal." },
        { quoted: msg },
      );
    }
  },
};
