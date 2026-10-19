import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "@/src/core/database.js";
import { getFfmpegPath } from "./ffmpeg.js";
import { getSharp } from "@/src/utils/native.js";
import { buildStickerExif, injectExif, isWebP } from "./exif.js";
import { isVideoOrAnimated } from "./buffer.js";

const execFileAsync = promisify(execFile);

export const STICKER_VIDEO_MAX_SECONDS = 7;

function toFfmpegTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function ffmpegStaticToWebp(buffer) {
  const cacheDir = path.join(process.cwd(), "assets", "cache");
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (_) {}
  }
  const tmpBase = path.join(cacheDir, `stkimg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inFile = `${tmpBase}.png`;
  const outFile = `${tmpBase}.webp`;
  await fsp.writeFile(inFile, buffer);
  try {
    await execFileAsync(
      getFfmpegPath(),
      [
        "-y",
        "-i",
        inFile,
        "-vf",
        "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,fps=15",
        "-loop",
        "0",
        "-preset",
        "picture",
        "-an",
        "-quality",
        "90",
        outFile,
      ],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );
    return await fsp.readFile(outFile);
  } finally {
    await fsp.unlink(inFile).catch(() => {});
    await fsp.unlink(outFile).catch(() => {});
  }
}

async function ensureWebp(buffer, animated) {
  if (isWebP(buffer)) return buffer;
  if (!animated) {
    try {
      const converted = await ffmpegStaticToWebp(buffer);
      if (isWebP(converted)) return converted;
    } catch (err) {
      const reason = String(err?.message || err).split("\n")[0];
      console.warn("[createSticker] konversi akhir ke webp gagal:", reason);
    }
  }
  throw new Error(
    "Gagal mengubah media menjadi stiker WebP yang valid. " +
      (getSharp()
        ? "Pastikan ffmpeg terpasang dengan benar."
        : "Modul sharp tidak tersedia dan konversi ffmpeg gagal; install sharp atau ffmpeg lalu coba lagi.")
  );
}

async function createTextOverlay({ width, height, topText, bottomText, textOpts = {} }) {
  try {
    const { createTextOverlayCanvas } = await import("./text.js");
    return await createTextOverlayCanvas(width, height, { topText, bottomText, ...textOpts });
  } catch (_) {
    return null;
  }
}

function isGif(buffer) {
  return buffer && buffer.length >= 3 && buffer.slice(0, 3).toString() === "GIF";
}

async function shrinkIfTooBig(webpBuffer, maxBytes = 950 * 1024) {
  if (!webpBuffer || webpBuffer.length <= maxBytes) return webpBuffer;
  const sharp = getSharp();
  if (!sharp) return webpBuffer;
  try {
    const smaller = await sharp(webpBuffer, { animated: true }).webp({ quality: 70, effort: 4 }).toBuffer();
    if (smaller.length < webpBuffer.length) return smaller;
  } catch (_) {}
  return webpBuffer;
}

async function gifFallback(buffer, { topText, bottomText, hasText, textOpts = {} }) {
  const sharp = getSharp();
  if (sharp && isGif(buffer)) {
    try {
      let pipe = sharp(buffer, { animated: true });
      if (hasText) {
        const overlayBuf = await createTextOverlay({ width: 512, height: 512, topText, bottomText, textOpts });
        if (overlayBuf) {
          pipe = pipe.composite([{ input: overlayBuf, gravity: "north" }]);
        }
      }
      const out = await pipe
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: sharp.kernel.lanczos3,
        })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
      return await shrinkIfTooBig(out);
    } catch (err) {
      console.warn("[createSticker] gif sharp fallback gagal:", err?.message || err);
    }
  }
  throw new Error(
    "Gagal mengubah video/GIF menjadi stiker (ffmpeg tidak tersedia/gagal). " +
      "Install ffmpeg lalu coba lagi. " +
      (isGif(buffer) ? "" : "Untuk video, ffmpeg wajib terinstall.")
  );
}

export async function createSticker(
  buffer,
  { pack, author, topText, bottomText, font, fontSize, maxSize, wordsPerLine, position, align } = {}
) {
  const activeSettings = db.getSettings();
  const packName = pack === undefined ? activeSettings.stickerPackName : pack;
  const authorName = author === undefined ? activeSettings.stickerAuthor : author;
  const hasText = Boolean((topText && topText.trim()) || (bottomText && bottomText.trim()));
  const textOpts = { font, fontSize, maxSize, wordsPerLine, position, align };
  const sharp = getSharp();

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
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
      } catch (_) {}
    }
    const tmpBase = path.join(cacheDir, `stk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inVid = `${tmpBase}.mp4`;
    const outWebp = `${tmpBase}.webp`;
    const overlayPng = `${tmpBase}-overlay.png`;

    await fsp.writeFile(inVid, buffer);
    let createdOverlay = false;

    try {
      if (hasText) {
        const overlayBuf = await createTextOverlay({ width: 512, height: 512, topText, bottomText, textOpts });
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
        "-ss",
        "00:00:00",
        "-t",
        toFfmpegTime(STICKER_VIDEO_MAX_SECONDS),
        "-i",
        inVid,
        ...(createdOverlay ? ["-i", overlayPng] : []),
        ...(createdOverlay ? ["-filter_complex", filters, "-map", "[outv]"] : ["-vf", filters]),
        "-loop",
        "0",
        "-preset",
        "picture",
        "-an",
        "-fps_mode",
        "passthrough",
        "-s",
        "512:512",

        "-quality",
        "90",
        "-compression_level",
        "6",
        outWebp,
      ];

      await execFileAsync(getFfmpegPath(), ffmpegArgs, { timeout: 90000, maxBuffer: 10 * 1024 * 1024 });
      webpBuffer = await fsp.readFile(outWebp);
      webpBuffer = await shrinkIfTooBig(webpBuffer);
    } catch (vidErr) {
      console.warn("[createSticker] video ffmpeg conversion error:", vidErr?.message || vidErr);
      webpBuffer = await gifFallback(buffer, { topText, bottomText, hasText, textOpts });
    } finally {
      await fsp.unlink(inVid).catch(() => {});
      if (createdOverlay) await fsp.unlink(overlayPng).catch(() => {});
      await fsp.unlink(outWebp).catch(() => {});
    }
  } else if (isAnimatedWebp) {
    if (!sharp) {
      webpBuffer = buffer;
    } else {
      try {
        let animSharp = sharp(buffer, { animated: true });
        if (hasText) {
          const overlayBuf = await createTextOverlay({ width: 512, height: 512, topText, bottomText, textOpts });
          if (overlayBuf) {
            animSharp = animSharp.composite([{ input: overlayBuf, tile: true }]);
          }
        }
        webpBuffer = await animSharp
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            kernel: sharp.kernel.lanczos3,
          })
          .webp({
            quality: 85,
            smartSubsample: true,
            effort: 5,
          })
          .toBuffer();
      } catch (animErr) {
        console.warn("[createSticker] animated webp processing warning:", animErr?.message || animErr);
        webpBuffer = buffer;
      }
    }
  } else {
    let processedBuffer = buffer;
    if (hasText) {
      try {
        const { addTextToImage } = await import("./text.js");
        processedBuffer = await addTextToImage(buffer, { topText, bottomText, ...textOpts });
      } catch (_) {
        processedBuffer = buffer;
      }
    }

    if (sharp) {
      try {
        webpBuffer = await sharp(processedBuffer)
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            kernel: sharp.kernel.lanczos3,
          })
          .webp({
            quality: 95,
            smartSubsample: true,
            effort: 6,
          })
          .toBuffer();
      } catch (_) {
        webpBuffer = processedBuffer;
      }
    } else {
      try {
        webpBuffer = await ffmpegStaticToWebp(processedBuffer);
      } catch (_) {
        webpBuffer = processedBuffer;
      }
    }
  }

  if (!isWebP(webpBuffer)) {
    webpBuffer = await ensureWebp(webpBuffer, isVideo);
  }

  try {
    return injectExif(webpBuffer, buildStickerExif(packName || "", authorName || ""));
  } catch (_) {
    return webpBuffer;
  }
}
