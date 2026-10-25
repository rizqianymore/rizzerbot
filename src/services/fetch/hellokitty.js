import path from "path";
import fsp from "fs/promises";
import { requireCanvas, getSharp } from "@/src/utils/native.js";
import { ensureFont } from "./brat/assets.js";
import { normalizeText } from "./brat/text.js";

const SIZE = 512;
const SCALE = 2;
const FONT = "Arial Narrow";
const IMAGE_PATH = path.resolve(process.cwd(), "assets/image/hellokitty.png");

let kittyImageCache = null;

async function getKittyImage() {
  
  if (kittyImageCache) return kittyImageCache;
  const { loadImage } = requireCanvas();
  const buffer = await fsp.readFile(IMAGE_PATH);
  kittyImageCache = await loadImage(buffer);
  return kittyImageCache;
}

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
  const maxWidth = 470;
  const maxLines = 3;
  for (let size = 44; size >= 18; size -= 2) {
    ctx.font = `bold ${size}px "${FONT}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) continue;
    const maxSize = lines.length === 1 ? 44 : lines.length === 2 ? 36 : 28;
    if (size > maxSize) continue;
    return { lines, size, lineHeight: Math.round(size * 1.15) };
  }
  ctx.font = `bold 18px "${FONT}"`;
  return { lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines), size: 18, lineHeight: 22 };
}

export async function createHelloKittyImage(rawText, options = {}) {
  const text = normalizeText(rawText);
  if (!text.trim()) throw new Error("Teks sticker kosong");

  await ensureFont();
  const kittyImg = await getKittyImage();
  const { createCanvas } = requireCanvas();
  
  const canvas = createCanvas(SIZE * SCALE, SIZE * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  // Layout text first to calculate spacing
  const layout = layoutText(ctx, text);
  const totalTextHeight = layout.lines.length * layout.lineHeight;

  // Hello Kitty character dimensions
  // Target available height for Kitty: around 340px
  const targetKittyHeight = Math.min(340, SIZE - totalTextHeight - 50);
  const scaleKitty = targetKittyHeight / kittyImg.height;
  const kittyW = kittyImg.width * scaleKitty;
  const kittyH = targetKittyHeight;
  const kittyX = (SIZE - kittyW) / 2;
  const kittyY = 15;

  // Draw Hello Kitty Image
  ctx.drawImage(kittyImg, kittyX, kittyY, kittyW, kittyH);

  // Position text below the Hello Kitty image
  let y = kittyY + kittyH + 30;

  ctx.font = `bold ${layout.size}px "${FONT}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (const line of layout.lines) {
    // White text stroke/outline for maximum readability on dark & light WhatsApp backgrounds
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineJoin = "round";
    ctx.strokeText(line, SIZE / 2, y);

    // Black text fill
    ctx.fillStyle = options.color || "#111111";
    ctx.fillText(line, SIZE / 2, y);

    y += layout.lineHeight;
  }

  const png = await canvas.encode("png");
  const sharp = getSharp();
  if (!sharp) return png;
  return sharp(png).resize(SIZE, SIZE, { kernel: sharp.kernel.lanczos3 }).webp({ quality: 90 }).toBuffer();
}
