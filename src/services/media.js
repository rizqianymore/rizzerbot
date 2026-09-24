import { Sticker, StickerTypes } from "wa-sticker-formatter";
import sharp from "sharp";
import { settings } from "@/config/settings.js";

export async function getMediaBuffer(sock, msg) {
  try {
    return await sock.downloadMediaMessage(msg);
  } catch (_) {
    return null;
  }
}

export async function createSticker(buffer, { pack, author } = {}) {
  const sticker = new Sticker(buffer, {
    pack: pack || settings.stickerPackName,
    author: author || settings.stickerAuthor,
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