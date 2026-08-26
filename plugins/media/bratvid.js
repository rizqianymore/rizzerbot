import sharp from "sharp";
import axios from "axios";
import GIFEncoder from "gif-encoder-2";
import { createCanvas, loadImage } from "canvas";
import { settings } from "@/config/settings.js";
import { addStickerMetadata } from "@/src/services/sticker.js";

const CANVAS_SIZE = 512;
const PADDING = 44;
const MAX_CONTENT_WIDTH = CANVAS_SIZE - PADDING * 2;
const MAX_CONTENT_HEIGHT = CANVAS_SIZE - PADDING * 2;

const THEMES = {
  white: { bg: "#FFFFFF", text: "#000000", blur: 1.6 },
  green: { bg: "#8ACF00", text: "#000000", blur: 1.6 },
  black: { bg: "#000000", text: "#FFFFFF", blur: 1.6 },
  blue: { bg: "#0000FF", text: "#DE0100", blur: 0 },
};

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const emojiBase64Cache = new Map();
const textMeasureCache = new Map();

const FONT_FAMILY = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

function isEmojiChar(char) {
  return /\p{Extended_Pictographic}/u.test(char);
}

function emojiToCodePoints(emoji) {
  return [...emoji]
    .map((c) => c.codePointAt(0).toString(16).toLowerCase())
    .join("-");
}

async function getEmojiBase64(emoji) {
  const codePoints = emojiToCodePoints(emoji);
  if (emojiBase64Cache.has(codePoints)) {
    return emojiBase64Cache.get(codePoints) || null;
  }

  const urls = [
    `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${codePoints}.png`,
    `https://cdn.jsdelivr.net/gh/jdecked/twemoji@main/assets/72x72/${codePoints}.png`,
  ];

  if (codePoints.endsWith("-fe0f")) {
    const withoutFe0f = codePoints.replace(/-fe0f$/, "");
    urls.push(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${withoutFe0f}.png`);
  }

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 4000,
      });
      if (res.status === 200 && res.data) {
        const b64 = `data:image/png;base64,${Buffer.from(res.data).toString("base64")}`;
        emojiBase64Cache.set(codePoints, b64);
        return b64;
      }
    } catch (_) {}
  }

  emojiBase64Cache.set(codePoints, null);
  return null;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function measureText(text, fontSize) {
  if (!text) return 0;
  const key = `${fontSize}:${text}`;
  if (textMeasureCache.has(key)) return textMeasureCache.get(key);

  const svg = `<svg width="2000" height="400" xmlns="http://www.w3.org/2000/svg"><text x="0" y="${fontSize}" font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="500">${escapeXml(text)}</text></svg>`;
  try {
    const res = await sharp(Buffer.from(svg))
      .trim()
      .toBuffer({ resolveWithObject: true });
    const w =
      (res.info.width || 0) +
      (res.info.trimOffsetLeft ? Math.abs(res.info.trimOffsetLeft) : 0);
    textMeasureCache.set(key, w);
    return w;
  } catch {
    const fallback = text.length * fontSize * 0.55;
    textMeasureCache.set(key, fallback);
    return fallback;
  }
}

function tokenizeLine(lineStr) {
  const graphemes = [...segmenter.segment(lineStr)].map((s) => s.segment);
  const tokens = [];
  let currentText = "";

  for (const g of graphemes) {
    if (isEmojiChar(g)) {
      if (currentText) {
        tokens.push({ type: "text", value: currentText });
        currentText = "";
      }
      tokens.push({ type: "emoji", value: g });
    } else if (/\s/.test(g)) {
      if (currentText) {
        tokens.push({ type: "text", value: currentText });
        currentText = "";
      }
      tokens.push({ type: "space", value: " " });
    } else {
      currentText += g;
    }
  }

  if (currentText) {
    tokens.push({ type: "text", value: currentText });
  }

  return tokens;
}

async function getTokenWidth(token, fontSize) {
  if (token.type === "emoji") {
    return fontSize * 1.1;
  }
  if (token.type === "space") {
    return fontSize * 0.28;
  }
  return await measureText(token.value, fontSize);
}

async function wrapLineTokens(tokens, fontSize) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const token of tokens) {
    const w = await getTokenWidth(token, fontSize);
    if (token.type === "space" && currentLine.length === 0) continue;

    if (currentWidth + w <= MAX_CONTENT_WIDTH || currentLine.length === 0) {
      currentLine.push({ ...token, width: w });
      currentWidth += w;
    } else {
      while (
        currentLine.length &&
        currentLine[currentLine.length - 1].type === "space"
      ) {
        currentLine.pop();
      }
      if (currentLine.length) lines.push(currentLine);
      if (token.type === "space") {
        currentLine = [];
        currentWidth = 0;
      } else {
        currentLine = [{ ...token, width: w }];
        currentWidth = w;
      }
    }
  }

  while (
    currentLine.length &&
    currentLine[currentLine.length - 1].type === "space"
  ) {
    currentLine.pop();
  }
  if (currentLine.length) lines.push(currentLine);

  return lines;
}

async function calculateLayout(rawText) {
  const paragraphs = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const paragraphTokens = paragraphs.map(tokenizeLine);

  const allEmojis = [];
  for (const p of paragraphTokens) {
    for (const t of p) {
      if (t.type === "emoji") allEmojis.push(t.value);
    }
  }
  try {
    await Promise.all(allEmojis.map(getEmojiBase64));
  } catch (_) {}

  let low = 16;
  let high = 140;
  let optimalSize = 16;
  let optimalLines = [];

  while (low <= high) {
    const testSize = Math.floor((low + high) / 2);
    const allLinesForTest = [];

    for (const tokens of paragraphTokens) {
      const wrapped = await wrapLineTokens(tokens, testSize);
      allLinesForTest.push(...wrapped);
    }

    const lineHeight = testSize * 1.15;
    const totalHeight = allLinesForTest.length * lineHeight;
    const maxLineWidth = Math.max(
      ...allLinesForTest.map((line) =>
        line.reduce((acc, tok) => acc + (tok.width || 0), 0)
      ),
      0
    );

    if (
      totalHeight <= MAX_CONTENT_HEIGHT &&
      maxLineWidth <= MAX_CONTENT_WIDTH &&
      allLinesForTest.length <= 10
    ) {
      optimalSize = testSize;
      optimalLines = allLinesForTest;
      low = testSize + 1;
    } else {
      high = testSize - 1;
    }
  }

  if (optimalLines.length === 0) {
    for (const tokens of paragraphTokens) {
      const wrapped = await wrapLineTokens(tokens, optimalSize);
      optimalLines.push(...wrapped);
    }
  }

  return { optimalSize, lines: optimalLines, allEmojis };
}

function buildSvgForLines(lines, optimalSize, theme) {
  const lineHeight = optimalSize * 1.15;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (CANVAS_SIZE - totalTextHeight) / 2;

  const svgElements = [];

  lines.forEach((line, lineIdx) => {
    const adjustedTokens = [];
    for (let i = 0; i < line.length; i++) {
      const tok = line[i];
      adjustedTokens.push(tok);
      const nextTok = line[i + 1];
      if (
        (tok.type === "text" && nextTok && nextTok.type === "emoji") ||
        (tok.type === "emoji" && nextTok && nextTok.type === "text")
      ) {
        adjustedTokens.push({
          type: "space",
          value: " ",
          width: optimalSize * 0.15,
        });
      }
    }

    const lineWidth = adjustedTokens.reduce(
      (acc, tok) => acc + (tok.width || 0),
      0
    );
    let currentX = (CANVAS_SIZE - lineWidth) / 2;
    const lineY = startY + lineIdx * lineHeight;

    for (const token of adjustedTokens) {
      const tokenW = token.width || 0;
      if (token.type === "emoji") {
        const b64 = emojiBase64Cache.get(emojiToCodePoints(token.value));
        const emojiSize = optimalSize * 0.95;
        const emojiY = lineY + (lineHeight - emojiSize) / 2;
        if (b64) {
          svgElements.push(
            `<image href="${b64}" x="${currentX.toFixed(1)}" y="${emojiY.toFixed(1)}" width="${emojiSize.toFixed(1)}" height="${emojiSize.toFixed(1)}" />`
          );
        } else {
          svgElements.push(
            `<text x="${(currentX + tokenW / 2).toFixed(1)}" y="${(lineY + lineHeight * 0.8).toFixed(1)}" text-anchor="middle" font-family="'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" font-size="${optimalSize}" fill="${theme.text}">${escapeXml(token.value)}</text>`
          );
        }
      } else if (token.type === "text") {
        const textY = lineY + lineHeight * 0.8;
        svgElements.push(
          `<text x="${currentX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="start" font-family="${FONT_FAMILY}" font-size="${optimalSize}" font-weight="500" fill="${theme.text}">${escapeXml(token.value)}</text>`
        );
      }
      currentX += tokenW;
    }
  });

  return `
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${theme.bg}"/>
      ${svgElements.join("\n")}
    </svg>
  `;
}

function parseArgs(raw) {
  const normalized = raw.trim();
  const match = normalized.match(/^(white|green|black|blue)\s+([\s\S]+)$/i);
  if (match) {
    const theme = match[1].toLowerCase();
    return {
      theme,
      text: match[2].trim(),
    };
  }
  return {
    theme: "white",
    text: normalized,
  };
}

async function renderFrameBuffer(svgString, blur) {
  let sharpInstance = sharp(Buffer.from(svgString));
  if (blur > 0) {
    sharpInstance = sharpInstance.blur(blur);
  }
  return await sharpInstance.png().toBuffer();
}

export default {
  name: "bratvid",
  description:
    "Membuat stiker video/animasi teks Brat autentik dengan tema dan dukungan emoji.",
  usage: "[white|green|black|blue] <teks>",
  example: "party girl 🔥 💅",
  aliases: ["bratgif", "bratanim", "bratvideo"],
  category: "Media",
  premiumOnly: true,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping }) => {
    const rawInput = args.join(" ").trim();
    if (!rawInput) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap tentukan teks untuk stiker animasi Brat.\n\n*Format:* `.bratvid [tema] <teks>`\n*Pilihan tema:* `white` (default), `green`, `black`, `blue`\n*Contoh:* `.bratvid 365 party girl 🔥`",
        },
        { quoted: msg }
      );
      return;
    }

    if (rawInput.length > 80) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Maksimal 80 karakter diperbolehkan untuk stiker animasi Brat." },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    try {
      const { theme: themeName, text } = parseArgs(rawInput);
      const theme = THEMES[themeName] || THEMES.white;

      const { optimalSize, allEmojis } = await calculateLayout(text.trim());

      const words = text.split(" ");
      const frames = [];

      for (let i = 0; i < words.length; i++) {
        const subText = words.slice(0, i + 1).join(" ");
        const tokens = tokenizeLine(subText);
        const wrapped = await wrapLineTokens(tokens, optimalSize);
        const svgStr = buildSvgForLines(wrapped, optimalSize, theme);
        const pngBuf = await renderFrameBuffer(svgStr, theme.blur);
        frames.push(pngBuf);
      }

      const encoder = new GIFEncoder(CANVAS_SIZE, CANVAS_SIZE, "octree", false);
      encoder.start();
      encoder.setDelay(350);
      encoder.setRepeat(0);

      const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      const ctx = canvas.getContext("2d");

      for (const frameBuf of frames) {
        const img = await loadImage(frameBuf);
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        encoder.addFrame(ctx);
      }

      encoder.finish();
      let gifBuffer = encoder.out.getData();

      const extractedEmojis = [...new Set(allEmojis || [])];
      const emojiParam = extractedEmojis.length > 0 ? extractedEmojis : undefined;

      gifBuffer = await addStickerMetadata(
        gifBuffer,
        settings.stickerPackName,
        settings.stickerAuthor,
        true,
        emojiParam
      );

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          sticker: gifBuffer,
          mimetype: "image/webp",
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[Bratvid Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal membuat stiker animasi Brat: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
