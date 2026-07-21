import GIFEncoder from "gif-encoder-2";
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
  description: "Membuat stiker video teks Brat bergerak.",
  usage: "<teks>",
  example: "Kyros-MD",
  name: "bratvid",
  aliases: ["bratgif", "bratanim", "bratvideo"],
  category: "Media",
  cooldown: 8000,
  run: async (sock, msg, args, { sendTyping }) => {
    const text = args.join(" ");
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tentukan teks. Contoh: *.bratvid apel*" },
        { quoted: msg },
      );
      return;
    }

    if (text.length > 50) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Maksimal 50 karakter diperbolehkan untuk animasi." },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    try {
      const encoder = new GIFEncoder(512, 512, "octree", false);
      encoder.start();
      encoder.setDelay(400);
      encoder.setRepeat(0);

      const tempCanvas = createCanvas(256, 256);
      const tempCtx = tempCanvas.getContext("2d");

      const canvas = createCanvas(512, 512);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;

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

      let fontSize = 50;
      const paddingLeft = 14;
      const paddingTop = 18;
      const maxTextWidth = 256 - paddingLeft * 2;
      const maxTextHeight = 256 - paddingTop - 18;

      let finalLines = [];
      let finalLineHeight = 0;
      while (fontSize > 10) {
        tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;
        finalLineHeight = fontSize * 1.05;
        finalLines = wrapTextEmoji(tempCtx, text, maxTextWidth, fontSize);
        const totalHeight = finalLines.length * finalLineHeight;

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

      let accumulatedText = "";
      const fixedStartY = paddingTop;

      for (let i = 0; i < words.length; i++) {
        accumulatedText += (i === 0 ? "" : " ") + words[i];

        tempCtx.fillStyle = "#ffffff";
        tempCtx.fillRect(0, 0, 256, 256);

        tempCtx.fillStyle = "#000000";
        tempCtx.textBaseline = "top";
        tempCtx.font = `${fontSize}px "Arial Narrow", Arial, sans-serif`;

        const currentLines = wrapTextEmoji(
          tempCtx,
          accumulatedText,
          maxTextWidth,
          fontSize,
        );
        let startY = fixedStartY;

        for (let j = 0; j < currentLines.length; j++) {
          const line = currentLines[j];
          const isLastLine = j === currentLines.length - 1;
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
          startY += finalLineHeight;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(tempCanvas, 0, 0, 512, 512);

        encoder.addFrame(ctx);
      }

      encoder.finish();
      let gifBuffer = encoder.out.getData();

      try {
        const { addStickerMetadata } = await import("@/lib/stickerMetadata.js");
        const { settings } = await import("@/config/settings.js");
        const extractedEmojis = [...new Set(allEmojis)];
        const emojiParam =
          extractedEmojis.length > 0 ? extractedEmojis : undefined;
        gifBuffer = await addStickerMetadata(
          gifBuffer,
          settings.stickerPackName,
          settings.stickerAuthor,
          true,
          emojiParam,
        );
      } catch (metaErr) {
        console.error("Failed to add metadata for bratvid sticker:", metaErr);
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { sticker: gifBuffer, mimetype: "image/webp" },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Local Bratvid generator error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Gagal membuat stiker animasi Brat lokal." },
        { quoted: msg },
      );
    }
  },
};
