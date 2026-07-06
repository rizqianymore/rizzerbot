import fs from "fs";
import sharp from "sharp";

export async function getThumbnailBuffer(imagePath) {
  if (!imagePath) return null;
  try {
    if (!fs.existsSync(imagePath)) return null;
    let buffer = fs.readFileSync(imagePath);

    if (buffer.length <= 200 * 1024) {
      return buffer;
    }

    buffer = await sharp(buffer)
      .resize({ width: 960, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    if (buffer.length > 200 * 1024) {
      buffer = await sharp(buffer)
        .resize({ width: 720, fit: "inside" })
        .jpeg({ quality: 75 })
        .toBuffer();
    }

    return buffer;
  } catch (err) {
    console.error("Failed to process thumbnail image:", err.message);
    return null;
  }
}
