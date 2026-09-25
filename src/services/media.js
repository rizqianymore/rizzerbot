import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
import { db } from "@/src/core/database.js";

export async function getMediaBuffer(sock, msg) {
  try {
    return await sock.downloadMediaMessage(msg);
  } catch (_) {
    return null;
  }
}

import { createCanvas, loadImage } from "@napi-rs/canvas";

export async function addTextToImage(buffer, { topText = "", bottomText = "" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return buffer;

  const baseImage = await loadImage(buffer);
  const width = baseImage.width || 512;
  const height = baseImage.height || 512;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw original image
  ctx.drawImage(baseImage, 0, 0, width, height);

  const fontSize = Math.max(22, Math.floor(width / 10));
  const strokeWidth = Math.max(3, Math.floor(fontSize / 7));

  // Configure text style with emoji-supporting font stack
  ctx.font = `900 ${fontSize}px "Impact", "DejaVu Sans", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  if (top) {
    ctx.textBaseline = "top";
    const yTop = Math.max(12, Math.floor(height * 0.04));
    ctx.strokeText(top, width / 2, yTop);
    ctx.fillText(top, width / 2, yTop);
  }

  if (bottom) {
    ctx.textBaseline = "bottom";
    const yBottom = height - Math.max(12, Math.floor(height * 0.04));
    ctx.strokeText(bottom, width / 2, yBottom);
    ctx.fillText(bottom, width / 2, yBottom);
  }

  return canvas.toBuffer("image/png");
}

export async function createSticker(buffer, { pack, author, topText, bottomText } = {}) {
  let processedBuffer = buffer;
  if (topText || bottomText) {
    try {
      processedBuffer = await addTextToImage(buffer, { topText, bottomText });
    } catch (_) {
      processedBuffer = buffer;
    }
  }

  const activeSettings = db.getSettings();
  const sticker = new Sticker(processedBuffer, {
    pack: pack === undefined ? activeSettings.stickerPackName : pack,
    author: author === undefined ? activeSettings.stickerAuthor : author,
    quality: 80,
    type: StickerTypes.FULL,
  });
  return await sticker.toBuffer();
}

export async function webpToImage(buffer) {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch (err) {
    throw new Error("Gagal mengkonversi stiker ke gambar");
  }
}

export async function upscaleImage(buffer, scale = 2) {
  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    const width = Math.round((meta.width || 500) * scale);
    const height = Math.round((meta.height || 500) * scale);
    return await img
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  } catch (err) {
    throw new Error("Gagal memproses gambar");
  }
}

export async function imageToWebp(buffer) {
  const sticker = await createSticker(buffer);
  return sticker;
}