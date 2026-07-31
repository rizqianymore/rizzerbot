import { loadImage } from "canvas";

const EMOJI_REGEX = /\p{RGI_Emoji}/gv;

export function tokenize(text) {
  const tokens = [];
  let lastIndex = 0;
  let match;

  EMOJI_REGEX.lastIndex = 0;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: text.substring(lastIndex, match.index),
      });
    }
    tokens.push({ type: "emoji", value: match[0] });
    lastIndex = EMOJI_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.substring(lastIndex) });
  }

  return tokens;
}

export function getEmojiUrl(emoji) {
  const codePoints = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp) {
      codePoints.push(cp.toString(16));
    }
  }
  let codeStr = codePoints.join("-");

  if (codeStr.endsWith("-fe0f")) {
    codeStr = codeStr.slice(0, -5);
  }
  return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${codeStr}.png`;
}

export async function loadEmojiImages(emojis) {
  const uniqueEmojis = [...new Set(emojis)];
  const imageMap = new Map();

  await Promise.all(
    uniqueEmojis.map(async (emoji) => {
      const url = getEmojiUrl(emoji);
      try {
        const img = await loadImage(url);
        imageMap.set(emoji, img);
      } catch (err) {
        console.error(`Failed to load emoji image for ${emoji}:`, err);
      }
    })
  );

  return imageMap;
}

export function measureTokensWidth(ctx, tokens, fontSize) {
  let width = 0;
  for (const token of tokens) {
    if (token.type === "text") {
      width += ctx.measureText(token.value).width;
    } else if (token.type === "emoji") {
      width += fontSize * 1.05;
    }
  }
  return width;
}

export function drawTokens(ctx, tokens, x, y, fontSize, emojiImages) {
  let currentX = x;
  for (const token of tokens) {
    if (token.type === "text") {
      ctx.fillText(token.value, Math.round(currentX), Math.round(y));
      currentX += ctx.measureText(token.value).width;
    } else if (token.type === "emoji") {
      const img = emojiImages.get(token.value);
      const size = fontSize * 1.05;

      const yOffset = (fontSize - size) / 2;
      if (img) {
        ctx.drawImage(img, Math.round(currentX), Math.round(y + yOffset), Math.round(size), Math.round(size));
      } else {
        ctx.fillText(token.value, Math.round(currentX), Math.round(y));
      }
      currentX += size;
    }
  }
}

export function wrapTextEmoji(ctx, text, maxWidth, fontSize) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const combined = currentLine + " " + word;
    const tokens = tokenize(combined);
    const width = measureTokensWidth(ctx, tokens, fontSize);
    if (width < maxWidth) {
      currentLine = combined;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function drawTokensJustified(
  ctx,
  line,
  x,
  y,
  maxWidth,
  fontSize,
  emojiImages,
  isLastLine
) {
  const tokens = tokenize(line);
  const contentWidth = measureTokensWidth(ctx, tokens, fontSize);

  if (isLastLine || contentWidth >= maxWidth) {
    drawTokens(ctx, tokens, x, y, fontSize, emojiImages);
    return;
  }

  let spaceCount = 0;
  for (const token of tokens) {
    if (token.type === "text") {
      for (let i = 0; i < token.value.length; i++) {
        if (token.value[i] === " ") spaceCount++;
      }
    }
  }

  if (spaceCount === 0) {
    drawTokens(ctx, tokens, x, y, fontSize, emojiImages);
    return;
  }

  const extraSpace = (maxWidth - contentWidth) / spaceCount;
  let currentX = x;

  for (const token of tokens) {
    if (token.type === "text") {
      const parts = token.value.split(" ");
      for (let i = 0; i < parts.length; i++) {
        ctx.fillText(parts[i], Math.round(currentX), Math.round(y));
        currentX += ctx.measureText(parts[i]).width;
        if (i < parts.length - 1) {
          currentX += ctx.measureText(" ").width + extraSpace;
        }
      }
    } else if (token.type === "emoji") {
      const img = emojiImages.get(token.value);
      const size = fontSize * 1.05;
      const yOffset = (fontSize - size) / 2;
      if (img) {
        ctx.drawImage(img, Math.round(currentX), Math.round(y + yOffset), Math.round(size), Math.round(size));
      } else {
        ctx.fillText(token.value, Math.round(currentX), Math.round(y));
      }
      currentX += size;
    }
  }
}
