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
import { downloadMediaMessage, extractMessageContent } from "baileys";

const execFileAsync = promisify(execFile);

export function getFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localBin = path.join(process.cwd(), "bin", "ffmpeg");
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  const localBinWin = path.join(process.cwd(), "bin", "ffmpeg.exe");
  if (fs.existsSync(localBinWin)) {
    return localBinWin;
  }
  for (const sysPath of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(sysPath)) {
      return sysPath;
    }
  }
  return "ffmpeg";
}

const { Image: WebpMuxImage } = webpmux;

export async function createTextOverlayCanvas(width = 512, height = 512, { topText = "", bottomText = "" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return null;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const fontSize = Math.max(22, Math.floor(width / 10));
  const strokeWidth = Math.max(3, Math.floor(fontSize / 7));

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

export async function addTextToImage(buffer, { topText = "", bottomText = "" } = {}) {
  const top = topText.trim();
  const bottom = bottomText.trim();
  if (!top && !bottom) return buffer;

  const baseImage = await loadImage(buffer);
  const width = baseImage.width || 512;
  const height = baseImage.height || 512;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(baseImage, 0, 0, width, height);

  const fontSize = Math.max(22, Math.floor(width / 10));
  const strokeWidth = Math.max(3, Math.floor(fontSize / 7));

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

const MEDIA_TYPES = ["imageMessage", "videoMessage", "stickerMessage", "documentMessage", "audioMessage"];

export function unwrapMessageContent(content) {
  try {
    if (!content) return content;
    let curr = content;
    for (let i = 0; i < 5; i++) {
      const extracted = extractMessageContent(curr);
      if (!extracted || extracted === curr) break;
      curr = extracted;
    }
    return curr || content;
  } catch (_) {
    return content;
  }
}

export function getQuotedMessage(msg) {
  const rawMsg = msg?.message || {};
  let ctxInfo = null;

  for (const val of Object.values(rawMsg)) {
    if (val && typeof val === "object" && val.contextInfo) {
      ctxInfo = val.contextInfo;
      break;
    }
  }

  const quotedMsg = ctxInfo?.quotedMessage ? unwrapMessageContent(ctxInfo.quotedMessage) : null;
  return { ctxInfo, quotedMsg, stanzaId: ctxInfo?.stanzaId, participant: ctxInfo?.participant };
}

export function findDownloadableTarget(msg) {
  if (!msg?.message) return null;
  const unwrapped = unwrapMessageContent(msg.message) || {};
  const directType = Object.keys(unwrapped).find((k) => MEDIA_TYPES.includes(k));
  if (directType) {
    return { ...msg, message: unwrapped };
  }

  const { ctxInfo, quotedMsg, stanzaId, participant } = getQuotedMessage(msg);
  if (quotedMsg) {
    const unwrappedQuoted = unwrapMessageContent(quotedMsg) || {};
    const quotedType = Object.keys(unwrappedQuoted).find((k) => MEDIA_TYPES.includes(k));
    if (quotedType) {
      return {
        key: {
          ...msg.key,
          ...(stanzaId ? { id: stanzaId } : {}),
          ...(participant ? { participant } : {}),
        },
        message: unwrappedQuoted,
      };
    }
  }
  return null;
}

export const DEFAULT_MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export function formatBytes(n) {
  if (!Number.isFinite(Number(n))) return "-";
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function checkMediaSize(buf, maxBytes) {
  if (buf && buf.length > maxBytes) {
    throw new Error(
      `Media terlalu besar (${formatBytes(buf.length)}, maks ${formatBytes(maxBytes)}). Kirim file yang lebih kecil.`
    );
  }
  return buf;
}

export async function getMediaBuffer(sock, msg, opts = {}) {
  if (!msg) return null;
  const maxBytes = Number(opts?.maxBytes) > 0 ? Number(opts.maxBytes) : DEFAULT_MAX_MEDIA_BYTES;

  let target = msg;
  if (!target.key && !target.message && typeof target === "object") {
    target = { key: {}, message: target };
  }
  try {
    const { default: pino } = await import("pino");
    const safeLogger = sock?.logger || pino({ level: "silent" });
    const buf = await downloadMediaMessage(
      target,
      "buffer",
      {},
      {
        logger: safeLogger,
        reuploadRequest: sock?.updateMediaMessage?.bind(sock),
      }
    );
    if (buf && buf.length > 0) return checkMediaSize(buf, maxBytes);
    return buf;
  } catch (err) {
    if (err && String(err.message || "").startsWith("Media terlalu besar")) throw err;

    try {
      if (typeof sock?.downloadMediaMessage === "function") {
        const buf2 = await sock.downloadMediaMessage(target);
        if (buf2 && buf2.length > 0) return checkMediaSize(buf2, maxBytes);
        return buf2;
      }
    } catch (err2) {
      if (err2 && String(err2.message || "").startsWith("Media terlalu besar")) throw err2;
    }
    console.warn("[getMediaBuffer] gagal download:", err?.message || err);
    return null;
  }
}

export function isVideoOrAnimated(buf) {
  if (!buf || buf.length < 12) return false;
  // GIF
  if (buf.slice(0, 3).toString() === "GIF") return true;
  // MP4 / MOV / 3GP
  const ftyp = buf.slice(4, 8).toString();
  if (ftyp === "ftyp" || ftyp === "moov") return true;
  if (buf.slice(0, 4).toString() === "\x00\x00\x00 ") return true;
  // WebM / MKV
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;
  // AVI
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "AVI ") return true;
  // Animated WebP
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
    if (buf.includes(Buffer.from("ANIM")) || buf.includes(Buffer.from("ANMF"))) return true;
  }
  return false;
}

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

export async function webpToImage(buffer) {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch (err) {
    throw new Error("Gagal mengkonversi stiker ke gambar");
  }
}

export async function webpToVideo(buffer) {
  try {
    const meta = await sharp(buffer, { animated: true }).metadata();
    const pages = meta.pages || 1;
    if (pages <= 1) {
      return null;
    }

    const cacheDir = path.join(process.cwd(), "assets", "cache");
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
    }
    const tmpDir = await fsp.mkdtemp(path.join(cacheDir, "webpvid-"));

    try {
      for (let i = 0; i < pages; i++) {
        const frame = await sharp(buffer, { animated: false, page: i }).png().toBuffer();
        await fsp.writeFile(path.join(tmpDir, `frame_${String(i).padStart(4, "0")}.png`), frame);
      }

      const outMp4 = path.join(tmpDir, "out.mp4");
      await execFileAsync(getFfmpegPath(), [
        "-y",
        "-framerate", "15",
        "-i", path.join(tmpDir, "frame_%04d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags", "+faststart",
        outMp4,
      ]);

      return await fsp.readFile(outMp4);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[webpToVideo] error:", err?.message || err);
    return null;
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
