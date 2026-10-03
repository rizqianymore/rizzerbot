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

function getFfmpegPath() {
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

const MEDIA_TYPES = ["imageMessage", "videoMessage", "stickerMessage", "documentMessage", "audioMessage"];

// Unwrap ephemeral / viewOnce / template wrappers to get true content
export function unwrapMessageContent(content) {
  try {
    if (!content) return content;
    return extractMessageContent(content) || content;
  } catch (_) {
    return content;
  }
}

export function getQuotedMessage(msg) {
  const msgType = Object.keys(msg?.message || {})[0];
  const ctxInfo =
    msg?.message?.[msgType]?.contextInfo ||
    msg?.message?.extendedTextMessage?.contextInfo ||
    msg?.message?.imageMessage?.contextInfo ||
    msg?.message?.videoMessage?.contextInfo ||
    msg?.message?.documentMessage?.contextInfo ||
    msg?.message?.stickerMessage?.contextInfo;
  return { ctxInfo, quotedMsg: ctxInfo?.quotedMessage, stanzaId: ctxInfo?.stanzaId, participant: ctxInfo?.participant };
}

// Cari pesan yang bisa di-download: kiriman langsung atau reply.
// Mengembalikan WAMessage siap download, atau null jika tidak ada media.
export function findDownloadableTarget(msg) {
  if (!msg?.message) return null;
  const unwrapped = unwrapMessageContent(msg.message) || {};
  const directType = Object.keys(unwrapped)[0];
  if (MEDIA_TYPES.includes(directType)) {
    // Pastikan msg.message sudah dalam bentuk unwrapped agar downloadMediaMessage mudah baca
    return { ...msg, message: unwrapped };
  }

  const { ctxInfo, quotedMsg, stanzaId, participant } = getQuotedMessage(msg);
  if (quotedMsg) {
    const unwrappedQuoted = unwrapMessageContent(quotedMsg) || {};
    const quotedType = Object.keys(unwrappedQuoted)[0];
    if (MEDIA_TYPES.includes(quotedType)) {
      return {
        key: {
          ...msg.key,
          ...(stanzaId ? { id: stanzaId } : {}),
          // participant asli quoted dibutuhkan untuk reupload di grup
          ...(participant ? { participant } : {}),
        },
        message: unwrappedQuoted,
      };
    }
  }
  return null;
}

// Batas unduhan media agar kiriman raksasa tidak bikin OOM/crash (DoS).
// WhatsApp sendiri membatasi media ~16MB; default 25MB masih longgar untuk
// stiker/HD/RVO, dan bisa dioverride per panggilan (mis. restore: 50MB).
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
  // Backward-compat: jika yang dilempar hanya inner content (quotedMessage),
  // bungkus jadi WAMessage minimal agar downloadMediaMessage bisa baca.
  let target = msg;
  if (!target.key && !target.message && typeof target === "object") {
    target = { key: {}, message: target };
  }
  try {
    const buf = await downloadMediaMessage(
      target,
      "buffer",
      {},
      {
        logger: sock?.logger || console,
        reuploadRequest: sock?.updateMediaMessage?.bind(sock),
      }
    );
    if (buf && buf.length > 0) return checkMediaSize(buf, maxBytes);
    return buf;
  } catch (err) {
    // Jangan telan error batas ukuran menjadi "gagal download" generik.
    if (err && String(err.message || "").startsWith("Media terlalu besar")) throw err;
    // Fallback ke method lama jika masih ada (baileys v6)
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
    const cacheDir = path.join(process.cwd(), "assets", "cache");
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
    }
    const tmpBase = path.join(cacheDir, `stk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inVid = `${tmpBase}.mp4`;
    const outWebp = `${tmpBase}.webp`;
    await fsp.writeFile(inVid, processedBuffer);
    try {
      await execFileAsync(getFfmpegPath(), [
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