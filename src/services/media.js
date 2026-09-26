import sharp from "sharp";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import webpmux from "node-webpmux";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { db } from "@/src/core/database.js";

const execFileAsync = promisify(execFile);
const { Image: WebpMuxImage } = webpmux;

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

export async function getMediaBuffer(sock, msg) {
  try {
    return await sock.downloadMediaMessage(msg);
  } catch (_) {
    return null;
  }
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
  const packName = pack === undefined ? activeSettings.stickerPackName : pack;
  const authorName = author === undefined ? activeSettings.stickerAuthor : author;

  // Check if buffer is mp4 or gif
  const isMp4 =
    (processedBuffer.length > 8 &&
      (processedBuffer.slice(4, 8).toString() === "ftyp" ||
        processedBuffer.slice(0, 4).toString() === "\x00\x00\x00 ")) ||
    processedBuffer.slice(0, 3).toString() === "GIF";

  let webpBuffer;
  if (isMp4) {
    const tmpBase = path.join(os.tmpdir(), `stk-${Math.random().toString(36).slice(2)}`);
    const inVid = `${tmpBase}.mp4`;
    const outWebp = `${tmpBase}.webp`;
    await fsp.writeFile(inVid, processedBuffer);
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        inVid,
        "-vf",
        "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15",
        "-loop",
        "0",
        "-ss",
        "00:00:00",
        "-t",
        "00:00:07",
        "-preset",
        "default",
        "-an",
        "-vsync",
        "0",
        "-s",
        "512:512",
        outWebp,
      ]);
      webpBuffer = await fsp.readFile(outWebp);
    } finally {
      await fsp.unlink(inVid).catch(() => {});
      await fsp.unlink(outWebp).catch(() => {});
    }
  } else {
    // If it's already a WebP image/sticker, try to load directly or normalize with sharp
    try {
      webpBuffer = await sharp(processedBuffer)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (_) {
      webpBuffer = processedBuffer;
    }
  }

  // Inject WhatsApp EXIF Metadata
  try {
    const img = new WebpMuxImage();
    await img.load(webpBuffer);

    const json = JSON.stringify({
      "sticker-pack-id": `rizzerbot-${Date.now()}`,
      "sticker-pack-name": packName || "",
      "sticker-pack-publisher": authorName || "",
      emojis: [],
    });

    const exif = Buffer.concat([
      Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x16, 0x00, 0x00, 0x00,
      ]),
      Buffer.from(json, "utf-8"),
    ]);
    exif.writeUIntLE(Buffer.byteLength(json), 14, 4);

    img.exif = exif;
    return await img.save(null);
  } catch (err) {
    return webpBuffer;
  }
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