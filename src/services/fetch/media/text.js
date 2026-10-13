import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

// Daftarkan font lokal ArialNarrow jika ada
const fontBratPath = path.join(process.cwd(), "assets", "brat", "ArialNarrow.ttf");
if (fs.existsSync(fontBratPath)) {
  try {
    GlobalFonts.registerFromPath(fontBratPath, "ArialNarrow");
  } catch (_) {}
}

const FONT_FALLBACK =
  '"Impact", "ArialNarrow", "DejaVu Sans", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

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

function calculateTextFit(ctx, text, maxWidth, maxHeight) {
  let optimalSize = 14;
  let optimalLines = [];
  let optimalLineHeight = 16;
  let optimalTotalHeight = 16;

  // Coba ukuran font dari besar ke kecil agar teks pas dan tidak terpotong
  const startSize = Math.max(22, Math.floor(maxWidth / 8));
  for (let size = startSize; size >= 14; size -= 2) {
    ctx.font = `900 ${size}px ${FONT_FALLBACK}`;
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

  // Jika masih melebihi maxHeight pada size 14, batasi baris
  if (optimalLines.length === 0) {
    optimalSize = 14;
    ctx.font = `900 14px ${FONT_FALLBACK}`;
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

function renderTextLines(ctx, fitResult, centerX, startY) {
  const { fontSize, lines, lineHeight } = fitResult;
  ctx.font = `900 ${fontSize}px ${FONT_FALLBACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(3, Math.floor(fontSize / 6));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    ctx.strokeText(line, centerX, y);
    ctx.fillText(line, centerX, y);
  });
}

export async function createTextOverlayCanvas(width = 512, height = 512, { topText = "", bottomText = "" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return null;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const marginX = Math.floor(width * 0.05);
  const maxTextWidth = width - marginX * 2;
  const maxSectionHeight = Math.floor(height * 0.4);
  const paddingY = Math.max(10, Math.floor(height * 0.03));

  if (top) {
    const fitTop = calculateTextFit(ctx, top, maxTextWidth, maxSectionHeight);
    renderTextLines(ctx, fitTop, width / 2, paddingY);
  }

  if (bottom) {
    const fitBottom = calculateTextFit(ctx, bottom, maxTextWidth, maxSectionHeight);
    const startY = height - paddingY - fitBottom.totalHeight;
    renderTextLines(ctx, fitBottom, width / 2, startY);
  }

  return canvas.toBuffer("image/png");
}

export async function addTextToImage(buffer, { topText = "", bottomText = "" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return buffer;

  const baseImage = await loadImage(buffer);
  const width = baseImage.width || 512;
  const height = baseImage.height || 512;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, width, height);

  const marginX = Math.floor(width * 0.05);
  const maxTextWidth = width - marginX * 2;
  const maxSectionHeight = Math.floor(height * 0.4);
  const paddingY = Math.max(10, Math.floor(height * 0.03));

  if (top) {
    const fitTop = calculateTextFit(ctx, top, maxTextWidth, maxSectionHeight);
    renderTextLines(ctx, fitTop, width / 2, paddingY);
  }

  if (bottom) {
    const fitBottom = calculateTextFit(ctx, bottom, maxTextWidth, maxSectionHeight);
    const startY = height - paddingY - fitBottom.totalHeight;
    renderTextLines(ctx, fitBottom, width / 2, startY);
  }

  return canvas.toBuffer("image/png");
}
