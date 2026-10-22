import { requireCanvas } from "@/src/utils/native.js";
import { ensureFont } from "./brat/assets.js";
import { normalizeText } from "./brat/text.js";

const SIZE = 512;
const FONT = "Arial Narrow";
const BG_COLOR = "#FFB6C1";
const TEXT_COLOR = "#111111";

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function layoutText(ctx, text) {
  const maxWidth = 440;
  for (let size = 88; size >= 18; size -= 2) {
    ctx.font = `${size}px "${FONT}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth) && lines.length <= 8) {
      return { lines, size, lineHeight: Math.round(size * 1.12) };
    }
  }
  ctx.font = `18px "${FONT}"`;
  return { lines: wrapLines(ctx, text, maxWidth).slice(0, 8), size: 18, lineHeight: 20 };
}

export async function createHelloKittyImage(rawText, options = {}) {
  const text = normalizeText(rawText);
  if (!text.trim()) throw new Error("Teks sticker kosong");

  await ensureFont();
  const { createCanvas } = requireCanvas();
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = options.bgColor || BG_COLOR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const layout = layoutText(ctx, text);
  const totalHeight = layout.lines.length * layout.lineHeight;
  let y = (SIZE - totalHeight) / 2 + layout.size * 0.8;

  ctx.font = `${layout.size}px "${FONT}"`;
  ctx.fillStyle = options.color || TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (const line of layout.lines) {
    ctx.fillText(line, SIZE / 2, y);
    y += layout.lineHeight;
  }

  return await canvas.encode("png");
}
