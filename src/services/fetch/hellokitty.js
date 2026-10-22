import { requireCanvas, getSharp } from "@/src/utils/native.js";
import { ensureFont } from "./brat/assets.js";
import { normalizeText } from "./brat/text.js";

const SIZE = 512;
const SUPERSAMPLE = 2;
const FONT = "Arial Narrow";
const TEXT_COLOR = "#D6336C";

function drawHeart(ctx, x, y, size, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-12, -4, -8, -14, 0, -7);
  ctx.bezierCurveTo(8, -14, 12, -4, 0, 7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

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
  ctx.strokeStyle = "#3A3A3A";
  ctx.stroke();
}

function drawBow(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#3A3A3A";

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
  const cy = 214;
  const rx = 124;
  const ry = 102;

  drawEar(ctx, [148, 158, 132, 70, 224, 112]);
  drawEar(ctx, [364, 158, 380, 70, 288, 112]);
  drawBow(ctx, 168, 120);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#3A3A3A";
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
  ctx.strokeStyle = "#3A3A3A";
  ctx.stroke();

  ctx.strokeStyle = "#3A3A3A";
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
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function layoutText(ctx, text) {
  const maxWidth = 420;
  const maxLines = 3;

  for (let size = 56; size >= 22; size -= 2) {
    ctx.font = `${size}px "${FONT}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) continue;
    const maxSize = lines.length === 1 ? 56 : lines.length === 2 ? 50 : 42;
    if (size > maxSize) continue;
    return { lines, size, lineHeight: Math.round(size * 1.12) };
  }

  ctx.font = `22px "${FONT}"`;
  return { lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines), size: 22, lineHeight: 25 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function createHelloKittyImage(rawText, options = {}) {
  const text = normalizeText(rawText);
  if (!text.trim()) throw new Error("Teks sticker kosong");

  await ensureFont();
  const { createCanvas } = requireCanvas();
  const canvas = createCanvas(SIZE * SUPERSAMPLE, SIZE * SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, "#FFE9F1");
  gradient.addColorStop(0.55, "#FFD1E1");
  gradient.addColorStop(1, "#FFB8D1");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "#FF6F9B";
  ctx.lineWidth = 14;
  roundRect(ctx, 7, 7, SIZE - 14, SIZE - 14, 34);
  ctx.stroke();

  drawHeart(ctx, 58, 76, 22, "#FF8FB3", -0.25);
  drawHeart(ctx, 452, 96, 28, "#FF8FB3", 0.3);
  drawHeart(ctx, 466, 330, 18, "#FFFFFF", 0.18);
  drawHeart(ctx, 44, 356, 20, "#FFFFFF", -0.2);

  drawKitty(ctx);

  const layout = layoutText(ctx, text);
  const totalHeight = layout.lines.length * layout.lineHeight;
  let y = 490 - totalHeight + layout.size * 0.8;

  ctx.font = `${layout.size}px "${FONT}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, layout.size * 0.13);
  ctx.strokeStyle = "#FFFFFF";
  ctx.fillStyle = options.color || TEXT_COLOR;

  for (const line of layout.lines) {
    ctx.strokeText(line, SIZE / 2, y, 440);
    ctx.fillText(line, SIZE / 2, y, 440);
    y += layout.lineHeight;
  }

  const png = await canvas.encode("png");
  const sharp = getSharp();
  if (!sharp) return png;
  return sharp(png).resize(SIZE, SIZE, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
}
