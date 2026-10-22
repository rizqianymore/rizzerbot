import { requireCanvas, getSharp } from "@/src/utils/native.js";
import { ensureFont } from "./brat/assets.js";
import { normalizeText } from "./brat/text.js";

const SIZE = 512;
const SCALE = 2;
const FONT = "Arial Narrow";
const BG_COLOR = "#FFB6C1";
const TEXT_COLOR = "#111111";

function drawEar(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  ctx.lineTo(points[2], points[3]);
  ctx.lineTo(points[4], points[5]);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2B2B2B";
  ctx.stroke();
}

function drawBow(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#2B2B2B";

  ctx.beginPath();
  ctx.ellipse(-24, 0, 25, 19, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FF4D79";
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(24, 0, 25, 19, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FF4D79";
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#FFC2D6";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawKitty(ctx) {
  const cx = 256;
  const cy = 212;
  const rx = 124;
  const ry = 102;

  drawEar(ctx, [148, 156, 132, 68, 224, 110]);
  drawEar(ctx, [364, 156, 380, 68, 288, 110]);
  drawBow(ctx, 168, 118);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#2B2B2B";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 120, 160, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 66, cy + 34, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 66, cy + 34, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2B2B2B";
  ctx.beginPath();
  ctx.ellipse(cx - 44, cy, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 44, cy, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, cy + 27, 13, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFC93C";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#2B2B2B";
  ctx.stroke();

  ctx.strokeStyle = "#2B2B2B";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const dy of [-16, 0, 16]) {
    ctx.beginPath();
    ctx.moveTo(cx - 82, cy + dy);
    ctx.lineTo(cx - 138, cy + dy - (dy === 0 ? 0 : dy > 0 ? 6 : -6));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 82, cy + dy);
    ctx.lineTo(cx + 138, cy + dy - (dy === 0 ? 0 : dy > 0 ? 6 : -6));
    ctx.stroke();
  }
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
  const maxWidth = 430;
  const maxLines = 3;
  for (let size = 56; size >= 18; size -= 2) {
    ctx.font = `${size}px "${FONT}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) continue;
    const maxSize = lines.length === 1 ? 56 : lines.length === 2 ? 46 : 38;
    if (size > maxSize) continue;
    return { lines, size, lineHeight: Math.round(size * 1.12) };
  }
  ctx.font = `18px "${FONT}"`;
  return { lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines), size: 18, lineHeight: 20 };
}

export async function createHelloKittyImage(rawText, options = {}) {
  const text = normalizeText(rawText);
  if (!text.trim()) throw new Error("Teks sticker kosong");

  await ensureFont();
  const { createCanvas } = requireCanvas();
  const canvas = createCanvas(SIZE * SCALE, SIZE * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = options.bgColor || BG_COLOR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawKitty(ctx);

  const layout = layoutText(ctx, text);
  const totalHeight = layout.lines.length * layout.lineHeight;
  let y = 492 - totalHeight + layout.size * 0.8;

  ctx.font = `${layout.size}px "${FONT}"`;
  ctx.fillStyle = options.color || TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (const line of layout.lines) {
    ctx.fillText(line, SIZE / 2, y);
    y += layout.lineHeight;
  }

  const png = await canvas.encode("png");
  const sharp = getSharp();
  if (!sharp) return png;
  return sharp(png).resize(SIZE, SIZE, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
}
