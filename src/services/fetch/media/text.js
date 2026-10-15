import fs from "fs";
import path from "path";
import { requireCanvas } from "@/src/utils/native.js";
import { ensureEmojiFont } from "@/src/utils/emoji-font.js";

const fontBratPath = path.join(process.cwd(), "assets", "brat", "ArialNarrow.ttf");
let fontRegistered = false;
function ensureStickerFont() {
  if (fontRegistered) return;
  fontRegistered = true;
  if (!fs.existsSync(fontBratPath)) return;
  try {
    requireCanvas().GlobalFonts.registerFromPath(fontBratPath, "ArialNarrow");
  } catch (_) {}
}

let emojiTried = false;
async function ensureStickerEmoji() {
  if (emojiTried) return;
  emojiTried = true;
  try {
    await ensureEmojiFont();
  } catch (_) {}
}

const FONT_FALLBACK =
  '"Impact", "ArialNarrow", "DejaVu Sans", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

function fontStack(size, customFont) {
  const clean = String(customFont || "").replace(/[";]/g, "").trim().slice(0, 60);
  if (clean) return `900 ${size}px "${clean}", ${FONT_FALLBACK}`;
  return `900 ${size}px ${FONT_FALLBACK}`;
}

function splitWordIfTooLong(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let cur = "";
  for (const c of chars) {
    const test = cur + c;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
    } else {
      parts.push(cur);
      cur = c;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

function wrapLine(ctx, lineText, maxWidth) {
  const words = lineText.split(" ").filter(Boolean);
  const result = [];
  let cur = "";

  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
      continue;
    }
    if (cur) {
      result.push(cur);
      cur = "";
    }
    if (ctx.measureText(word).width <= maxWidth) {
      cur = word;
    } else {
      const parts = splitWordIfTooLong(ctx, word, maxWidth);
      result.push(...parts.slice(0, -1));
      cur = parts.at(-1) || "";
    }
  }
  if (cur) result.push(cur);
  return result;
}

function wrapText(ctx, text, maxWidth) {
  return text.split("\n").flatMap((line) => {
    const clean = line.trim();
    return clean ? wrapLine(ctx, clean, maxWidth) : [""];
  });
}

function calculateTextFit(ctx, text, maxWidth, maxHeight, { font = "", fontSize = 0, maxSize = 0 } = {}) {
  const fixed = Number(fontSize);
  if (Number.isFinite(fixed) && fixed >= 12 && fixed <= 200) {
    const size = Math.floor(fixed);
    ctx.font = fontStack(size, font);
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.ceil(size * 1.15);
    const maxAllowedLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    const kept = lines.slice(0, maxAllowedLines);
    if (lines.length > maxAllowedLines && kept.length > 0) {
      let lastLine = kept[kept.length - 1];
      while (lastLine.length > 0 && ctx.measureText(`${lastLine}...`).width > maxWidth) {
        lastLine = lastLine.slice(0, -1);
      }
      kept[kept.length - 1] = `${lastLine}...`;
    }
    return { fontSize: size, lines: kept, lineHeight, totalHeight: kept.length * lineHeight };
  }
  let optimalSize = 14;
  let optimalLines = [];
  let optimalLineHeight = 16;
  let optimalTotalHeight = 16;

  const startSize = Math.min(
    Math.max(22, Math.floor(maxWidth / 8)),
    Number.isFinite(Number(maxSize)) && Number(maxSize) >= 14 ? Math.floor(Number(maxSize)) : 999
  );
  for (let size = startSize; size >= 14; size -= 2) {
    ctx.font = fontStack(size, font);
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = Math.ceil(size * 1.15);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= maxHeight) {
      optimalSize = size;
      optimalLines = lines;
      optimalLineHeight = lineHeight;
      optimalTotalHeight = totalHeight;
      break;
    }
  }

  if (optimalLines.length === 0) {
    optimalSize = 14;
    ctx.font = fontStack(14, font);
    const lines = wrapText(ctx, text, maxWidth);
    optimalLineHeight = Math.ceil(14 * 1.15);
    const maxAllowedLines = Math.max(1, Math.floor(maxHeight / optimalLineHeight));
    optimalLines = lines.slice(0, maxAllowedLines);
    if (lines.length > maxAllowedLines && optimalLines.length > 0) {
      let lastLine = optimalLines[optimalLines.length - 1];
      while (lastLine.length > 0 && ctx.measureText(`${lastLine}...`).width > maxWidth) {
        lastLine = lastLine.slice(0, -1);
      }
      optimalLines[optimalLines.length - 1] = `${lastLine}...`;
    }
    optimalTotalHeight = optimalLines.length * optimalLineHeight;
  }

  return {
    fontSize: optimalSize,
    lines: optimalLines,
    lineHeight: optimalLineHeight,
    totalHeight: optimalTotalHeight,
  };
}

function paintLine(ctx, line, x, y) {
  ctx.strokeText(line, x, y);
  ctx.fillText(line, x, y);
}

function renderTextLines(ctx, fitResult, centerX, startY, { maxWidth = 0, align = "center", font = "" } = {}) {
  const { fontSize, lines, lineHeight } = fitResult;
  ctx.font = fontStack(fontSize, font);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(3, Math.floor(fontSize / 6));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    const isLast = idx === lines.length - 1;
    const words = align === "justify" && !isLast ? String(line).split(" ").filter(Boolean) : [];
    if (words.length > 1 && maxWidth > 0) {
      const wordsWidth = words.reduce((n, w) => n + ctx.measureText(w).width, 0);
      const gap = (maxWidth - wordsWidth) / (words.length - 1);
      if (gap > 0) {
        ctx.textAlign = "left";
        let x = centerX - maxWidth / 2;
        for (const w of words) {
          paintLine(ctx, w, x, y);
          x += ctx.measureText(w).width + gap;
        }
        return;
      }
    }
    ctx.textAlign = "center";
    paintLine(ctx, line, centerX, y);
  });
}

function drawFittedText(ctx, text, maxWidth, maxHeight, centerX, startY, opts = {}) {
  const fit = calculateTextFit(ctx, text, maxWidth, maxHeight, opts);
  renderTextLines(ctx, fit, centerX, startY, { maxWidth, align: opts.align, font: opts.font });
  return fit;
}

function layoutStickerText(ctx, width, height, { top = "", bottom = "", font = "", fontSize = 0, maxSize = 0, position = "", align = "center" } = {}) {
  const marginX = Math.floor(width * 0.05);
  const maxTextWidth = width - marginX * 2;
  const paddingY = Math.max(10, Math.floor(height * 0.03));
  const sectionHeight = Math.floor(height * 0.4);
  const opts = { font, fontSize, maxSize, align };
  const pos = String(position || "").toLowerCase();
  const box = { maxWidth: maxTextWidth, align, font };

  if (top && bottom) {
    if (pos === "tengah" || pos === "middle" || pos === "center") {
      const fitTop = calculateTextFit(ctx, top, maxTextWidth, sectionHeight, opts);
      const fitBottom = calculateTextFit(ctx, bottom, maxTextWidth, sectionHeight, opts);
      const gap = Math.floor(height * 0.04);
      const startY = Math.round((height - fitTop.totalHeight - gap - fitBottom.totalHeight) / 2);
      renderTextLines(ctx, fitTop, width / 2, startY, box);
      renderTextLines(ctx, fitBottom, width / 2, startY + fitTop.totalHeight + gap, box);
      return;
    }
    drawFittedText(ctx, top, maxTextWidth, sectionHeight, width / 2, paddingY, opts);
    const fitBottom = calculateTextFit(ctx, bottom, maxTextWidth, sectionHeight, opts);
    renderTextLines(ctx, fitBottom, width / 2, height - paddingY - fitBottom.totalHeight, box);
    return;
  }

  const single = top || bottom;
  if (!single) return;
  const fit = calculateTextFit(ctx, single, maxTextWidth, sectionHeight, opts);
  if (pos === "atas" || pos === "top") {
    renderTextLines(ctx, fit, width / 2, paddingY, box);
  } else if (pos === "bawah" || pos === "bottom") {
    renderTextLines(ctx, fit, width / 2, height - paddingY - fit.totalHeight, box);
  } else {
    renderTextLines(ctx, fit, width / 2, Math.round((height - fit.totalHeight) / 2), box);
  }
}

export async function createTextOverlayCanvas(width = 512, height = 512, { topText = "", bottomText = "", font = "", fontSize = 0, maxSize = 0, position = "", align = "center" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return null;

  const { createCanvas } = requireCanvas();
  ensureStickerFont();
  await ensureStickerEmoji();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  layoutStickerText(ctx, width, height, { top, bottom, font, fontSize, maxSize, position, align });

  return canvas.toBuffer("image/png");
}

export async function addTextToImage(buffer, { topText = "", bottomText = "", font = "", fontSize = 0, maxSize = 0, position = "", align = "center" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return buffer;

  const { createCanvas, loadImage } = requireCanvas();
  ensureStickerFont();
  await ensureStickerEmoji();
  const baseImage = await loadImage(buffer);
  const width = baseImage.width || 512;
  const height = baseImage.height || 512;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, width, height);
  layoutStickerText(ctx, width, height, { top, bottom, font, fontSize, maxSize, position, align });

  return canvas.toBuffer("image/png");
}
