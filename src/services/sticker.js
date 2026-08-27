import sharp from "sharp";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import webpmux from "node-webpmux";
import { settings } from "@/config/settings.js";

export async function addStickerMetadata(
  webpBuffer,
  packName = settings.stickerPackName,
  author = settings.stickerAuthor,
  isVideo = false,
  emojis = ["🤩", "🎉"]
) {
  try {
    const isGif = webpBuffer.toString("ascii", 0, 10).includes("GIF");
    const isAnimatedWebP = webpBuffer
      .toString("ascii", 0, 1000)
      .includes("ANIM");
    const isVideoChecked =
      (isVideo ||
      webpBuffer.toString("ascii", 0, 10).includes("ftyp") ||
      webpBuffer.toString("ascii", 0, 30).includes("mp4") ||
      webpBuffer.toString("ascii", 0, 50).toLowerCase().includes("matroska") ||
      webpBuffer.toString("ascii", 0, 50).toLowerCase().includes("webm")) &&
      !isGif &&
      !isAnimatedWebP;

    let webp;

    if (isVideoChecked) {
      const sticker = new Sticker(webpBuffer, {
        pack: packName,
        author: author,
        type: StickerTypes.FULL,
        quality: 40,
        categories: Array.isArray(emojis) ? emojis : ["🤩", "🎉"],
      });
      return await sticker.toBuffer();
    } else if (isGif || isAnimatedWebP) {
      webp = await sharp(webpBuffer, { animated: true })
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 40 })
        .toBuffer();
    } else {
      webp = await sharp(webpBuffer)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 50 })
        .toBuffer();
    }

    if (!Buffer.isBuffer(webpBuffer) || webpBuffer.length === 0) {
      return webpBuffer;
    }

    const json = {
      "sticker-pack-id": `kyros-md-${Date.now()}`,
      "sticker-pack-name": String(packName || settings.stickerPackName || ""),
      "sticker-pack-publisher": String(author || settings.stickerAuthor || ""),
      emojis: Array.isArray(emojis) && emojis.length ? emojis : ["🤩", "🎉"],
    };

    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf-8");
    if (jsonBuffer.length > 65535) {
      // Exif length safety threshold
      return webp;
    }

    const exifHeader = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);

    exifHeader.writeUInt32LE(jsonBuffer.length, 14);
    const exifBuffer = Buffer.concat([exifHeader, jsonBuffer]);

    const img = new webpmux.Image();
    await img.load(webp);
    img.exif = exifBuffer;

    return await img.save(null);
  } catch (err) {
    console.error("Failed to write sticker metadata locally:", err);
    return webpBuffer;
  }
}
