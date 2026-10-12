import sharp from "sharp";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import webpmux from "node-webpmux";
import { db } from "@/src/core/database.js";
import { getFfmpegPath } from "./ffmpeg.js";
import { createTextOverlayCanvas } from "./text.js";
import { addTextToImage } from "./text.js";
import { isVideoOrAnimated } from "./buffer.js";

const execFileAsync = promisify(execFile);

const { Image: WebpMuxImage } = webpmux;

export async function createSticker(buffer, { pack, author, topText, bottomText } = {}) {
  const activeSettings = db.getSettings();
  const packName = pack === undefined ? activeSettings.stickerPackName : pack;
  const authorName = author === undefined ? activeSettings.stickerAuthor : author;
  const hasText = Boolean((topText && topText.trim()) || (bottomText && bottomText.trim()));

  const isAnimatedWebp =
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "WEBP" &&
    (buffer.includes(Buffer.from("ANIM")) || buffer.includes(Buffer.from("ANMF")));

  const isVideo = !isAnimatedWebp && isVideoOrAnimated(buffer);

  let webpBuffer;

  if (isVideo) {
    const cacheDir = path.join(process.cwd(), "assets", "cache");
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
    }
    const tmpBase = path.join(cacheDir, `stk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inVid = `${tmpBase}.mp4`;
    const outWebp = `${tmpBase}.webp`;
    const overlayPng = `${tmpBase}-overlay.png`;

    await fsp.writeFile(inVid, buffer);
    let createdOverlay = false;

    try {
      if (hasText) {
        const overlayBuf = await createTextOverlayCanvas(512, 512, { topText, bottomText });
        if (overlayBuf) {
          await fsp.writeFile(overlayPng, overlayBuf);
          createdOverlay = true;
        }
      }

      const filters = createdOverlay
        ? "[0:v]scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,fps=15[base];[base][1:v]overlay=0:0[outv]"
        : "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,fps=15";

      const ffmpegArgs = [
        "-y",
        "-ss", "00:00:00",
        "-t", "00:00:07",
        "-i", inVid,
        ...(createdOverlay ? ["-i", overlayPng] : []),
        ...(createdOverlay ? ["-filter_complex", filters, "-map", "[outv]"] : ["-vf", filters]),
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-fps_mode", "passthrough",
        "-s", "512:512",
        outWebp,
      ];

      await execFileAsync(getFfmpegPath(), ffmpegArgs);
      webpBuffer = await fsp.readFile(outWebp);
    } catch (vidErr) {
      console.warn("[createSticker] video ffmpeg conversion error, fallback:", vidErr?.message || vidErr);
      webpBuffer = buffer;
    } finally {
      await fsp.unlink(inVid).catch(() => {});
      if (createdOverlay) await fsp.unlink(overlayPng).catch(() => {});
      await fsp.unlink(outWebp).catch(() => {});
    }
  } else if (isAnimatedWebp) {
    try {
      let animSharp = sharp(buffer, { animated: true });
      if (hasText) {
        const overlayBuf = await createTextOverlayCanvas(512, 512, { topText, bottomText });
        if (overlayBuf) {
          animSharp = animSharp.composite([{ input: overlayBuf, tile: true }]);
        }
      }
      webpBuffer = await animSharp
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (animErr) {
      console.warn("[createSticker] animated webp processing warning:", animErr?.message || animErr);
      webpBuffer = buffer;
    }
  } else {
    // Static Image
    let processedBuffer = buffer;
    if (hasText) {
      try {
        processedBuffer = await addTextToImage(buffer, { topText, bottomText });
      } catch (_) {
        processedBuffer = buffer;
      }
    }

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
