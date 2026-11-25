import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { resolveFfmpegPath } from "@/src/utils/termux.js";
import { ffmpegStreamConvert } from "./media/stream.js";
import { isVideoOrAnimated } from "./media/buffer.js";

const execFileAsync = promisify(execFile);

let activeFfmpegCount = 0;
const ffmpegQueue = [];

function acquireFfmpegSlot() {
  if (activeFfmpegCount < 2) {
    activeFfmpegCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => ffmpegQueue.push(resolve));
}

function releaseFfmpegSlot() {
  activeFfmpegCount--;
  if (ffmpegQueue.length > 0) {
    activeFfmpegCount++;
    const next = ffmpegQueue.shift();
    next();
  }
}

function withTimeout(promise, ms, label = "Operation") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function detectMediaType(buffer) {
  if (!buffer || buffer.length < 3) return "unknown";
  if (buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image";
    if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return "image";
    if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return "image";
    if (buffer.slice(0, 3).toString() === "GIF") return "image";
    if (isVideoOrAnimated(buffer)) {
      if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "video";
      return "video";
    }
  }

  if (buffer.slice(0, 3).toString() === "ID3") return "audio";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "audio"; // MPEG Audio Frame sync

  if (buffer.length >= 8 && buffer.slice(4, 8).toString() === "ftyp") return "video";

  if (buffer.length >= 4 && buffer.slice(0, 4).toString() === "OggS") return "audio";
  return "unknown";
}

export function sniffMime(buffer, fallback = "video/mp4") {
  const t = detectMediaType(buffer);
  if (t === "image") {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
    if (buffer[0] === 0x89) return "image/png";
    if (buffer.slice(0, 4).toString() === "RIFF") return "image/webp";
    return "image/jpeg";
  }
  if (t === "audio") return "audio/mpeg";
  if (t === "video") return "video/mp4";
  return fallback;
}

async function ffmpegConvertBuffer(inputBuffer, inputExt, outputExt, extraArgs = []) {
  await acquireFfmpegSlot();
  const cacheDir = path.join(os.tmpdir(), "rizzerbot-compat");
  await fsp.mkdir(cacheDir, { recursive: true }).catch(() => { });
  const base = path.join(cacheDir, `cvt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inFile = `${base}_in.${inputExt}`;
  const outFile = `${base}_out.${outputExt}`;
  await fsp.writeFile(inFile, inputBuffer);
  try {
    await execFileAsync(resolveFfmpegPath(), ["-y", "-i", inFile, ...extraArgs, outFile], {
      timeout: 80000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return await fsp.readFile(outFile);
  } finally {
    releaseFfmpegSlot();
    await fsp.unlink(inFile).catch(() => { });
    await fsp.unlink(outFile).catch(() => { });
  }
}

export async function ensureVideoCompatible(buffer) {
  if (!buffer || buffer.length < 100) return buffer;
  const type = detectMediaType(buffer);

  if (type === "image" && buffer.slice(0, 4).toString() !== "RIFF") {
    return buffer;
  }

  const isMp4 = buffer.slice(4, 8).toString() === "ftyp";
  if (isMp4) {
    const headerPrefix = buffer.slice(0, Math.min(buffer.length, 4096)).toString("binary");
    if (headerPrefix.includes("avc1") || headerPrefix.includes("isom") || headerPrefix.includes("mp42")) {
      return buffer;
    }
  }

  try {
    let inputExt = "mp4";
    if (buffer[0] === 0x1a && buffer[1] === 0x45) inputExt = "webm";
    else if (isMp4) inputExt = "mp4";
    else if (buffer.slice(0, 3).toString() === "GIF") inputExt = "gif";
    else inputExt = "bin";

    const out = await ffmpegConvertBuffer(buffer, inputExt, "mp4", [
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "26",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    ]);
    return out && out.length > 100 ? out : buffer;
  } catch (_) {
    return buffer;
  }
}

export async function ensureAudioCompatible(buffer) {
  if (!buffer || buffer.length < 100) return buffer;

  if (buffer.slice(0, 3).toString() === "ID3") {
    return buffer;
  }

  // Coba stream in-memory langsung tanpa menyentuh disk
  try {
    const streamOut = await ffmpegStreamConvert(
      buffer,
      ["-vn", "-acodec", "libmp3lame", "-b:a", "128k", "-f", "mp3"],
      20000
    );
    if (streamOut && streamOut.length > 100) {
      return streamOut;
    }
  } catch (_) { }

  try {
    let inputExt = "bin";
    if (buffer.slice(0, 4).toString() === "OggS") inputExt = "ogg";
    else if (buffer.slice(4, 8).toString() === "ftyp") inputExt = "m4a";
    const out = await ffmpegConvertBuffer(buffer, inputExt, "mp3", ["-c:a", "libmp3lame", "-q:a", "2"]);
    return out && out.length > 100 ? out : buffer;
  } catch (_) {
    return buffer;
  }
}

export function isProbablyPlayable(buffer, mode) {
  const t = detectMediaType(buffer);
  if (mode === "audio") return t === "audio" || t === "video";
  if (mode === "video") return t === "video" || t === "image";
  return true;
}

export async function unifiedDownload(
  url,
  { mode = "video", logger, timeoutMs: _timeoutMs = 20000, skipCache = false } = {}
) {
  const isAudio = mode === "audio";
  const cacheKey = `${mode}:${String(url).trim()}`;
  const targetUrl = String(url || "").trim();

  if (!skipCache) {
    try {
      const { getCachedMedia } = await import("./mediaCache.js");
      const cached = await getCachedMedia(cacheKey);
      if (cached?.buffer?.length > 100) {
        logger?.info?.(`[downloader cache HIT] ${targetUrl}`);
        return {
          buffer: cached.buffer,
          info: cached.info,
          source: "smart-cache",
          rawBuffer: cached.buffer,
        };
      }
    } catch (_) { }
  }

  let lastErr = null;
  let rawBuffer = null;
  let info = null;
  let source = "";

  const lower = targetUrl.toLowerCase();

  if (/tiktok\.com|douyin\.com/i.test(lower)) {
    try {
      const { downloadViaSnaptik } = await import("./snaptik.js");
      const snap = await withTimeout(downloadViaSnaptik(targetUrl, { isAudio }), 7000, "Snaptik");
      if (snap?.buffer?.length > 100) {
        rawBuffer = snap.buffer;
        info = snap.info;
        source = snap.source || "snaptik-link";
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat snaptik] ${err?.message || err}`);
    }
  }

  if (!rawBuffer) {
    try {
      const { request } = await import("@/src/utils/request.js");
      if (/tiktok\.com/i.test(lower)) {
        const { downloadTiktok } = await import("./kolid.js");
        const kd = await withTimeout(downloadTiktok(targetUrl), 7000, "Kol.id TikTok");
        const targetDl = isAudio ? kd?.mp3 : kd?.noWatermark || kd?.watermark;
        if (targetDl) {
          const buf = await request.buffer(targetDl, { timeout: 12000, bypassCloudflare: "auto" });
          if (buf?.length > 100) {
            rawBuffer = buf;
            info = { title: kd.title, uploader: kd.author, duration: kd.duration };
            source = "kol.id";
          }
        }
      } else if (/instagram\.com/i.test(lower)) {
        const { downloadInstagram } = await import("./kolid.js");
        const kd = await withTimeout(downloadInstagram(targetUrl), 7000, "Kol.id Instagram");
        const firstMedia = kd?.media?.[0]?.url;
        if (firstMedia) {
          const buf = await request.buffer(firstMedia, { timeout: 12000, bypassCloudflare: "auto" });
          if (buf?.length > 100) {
            rawBuffer = buf;
            info = { title: kd.title, uploader: kd.username };
            source = "kol.id";
          }
        }
      } else if (/youtube\.com|youtu\.be/i.test(lower)) {
        const { downloadYoutube } = await import("./kolid.js");
        const kd = await withTimeout(downloadYoutube(targetUrl), 8000, "Kol.id YouTube");
        if (kd?.videoUrl) {
          const buf = await request.buffer(kd.videoUrl, { timeout: 15000, bypassCloudflare: "auto" });
          if (buf?.length > 100) {
            rawBuffer = buf;
            info = { title: kd.title, uploader: kd.channelName, duration: kd.duration };
            source = "kol.id";
          }
        }
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat kol.id] ${err?.message || err}`);
    }
  }

  if (!rawBuffer) {
    try {
      const { downloadSocialMedia } = await import("./socialdownloader.js");
      const sd = await downloadSocialMedia(targetUrl, { isAudio, logger, timeout: 6000, downloadTimeout: 12000 });
      if (sd?.buffer?.length > 100) {
        rawBuffer = sd.buffer;
        info = sd.info;
        source = "socialdownloader";
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat socialdownloader] ${err?.message || err}`);
    }
  }

  if (!rawBuffer && /\.(mp4|mp3|m4a|wav|mov|webm|webp|png|jpg|jpeg)(\?.*)?$/i.test(targetUrl)) {
    try {
      const { request } = await import("@/src/utils/request.js");
      const buf = await request.buffer(targetUrl, { timeout: 15000, bypassCloudflare: "auto" });
      if (buf?.length > 100) {
        rawBuffer = buf;
        info = { title: targetUrl.split("/").pop().split("?")[0] };
        source = "direct-link";
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (!rawBuffer) {
    throw lastErr || new Error("Gagal mengunduh media dari seluruh link engine.");
  }

  let buffer = rawBuffer;
  if (isAudio) {
    const t = detectMediaType(buffer);
    if (t === "video") {
      buffer = await ensureAudioCompatible(buffer);
    } else if (t !== "audio") {
      const conv = await ensureAudioCompatible(buffer);
      if (conv) buffer = conv;
    }
  } else {
    const t = detectMediaType(buffer);
    if (t === "video" || t === "unknown") {
      const conv = await ensureVideoCompatible(buffer);

      if (conv && conv.length > 100) buffer = conv;
    } else if (t === "audio") {

    }
  }

  if (buffer && buffer.length > 100 && !skipCache) {
    try {
      const { setCachedMedia } = await import("./mediaCache.js");
      const mime = sniffMime(buffer, isAudio ? "audio/mpeg" : "video/mp4");
      await setCachedMedia(cacheKey, buffer, { mime, info });
    } catch (_) { }
  }

  return { buffer, info, source, rawBuffer };
}

export function parseMediaIndexSelection(text, totalCount) {
  if (!text || typeof text !== "string") return null;
  const str = text.trim().toLowerCase();
  if (str === "all" || str === "semua") return null;

  const indices = new Set();
  const parts = str.split(/[,\s]+/);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          if (i >= 1 && i <= totalCount) indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= totalCount) {
        indices.add(num - 1);
      }
    }
  }

  if (indices.size === 0) return null;
  return Array.from(indices).sort((a, b) => a - b);
}

export async function extractMultiMedia(url, { isAudio = false, logger } = {}) {
  const targetUrl = String(url || "").trim();
  const items = [];
  let meta = null;

  if (/tiktok\.com|douyin\.com/i.test(targetUrl)) {
    try {
      const { downloadViaSnaptik } = await import("./snaptik.js");
      const snap = await downloadViaSnaptik(targetUrl, { isAudio });
      if (snap?.isSlide && Array.isArray(snap.images) && snap.images.length > 0) {
        snap.images.forEach((imgUrl) => {
          items.push({ type: "image", url: imgUrl });
        });
        return {
          items,
          info: snap.info,
          source: "tiktok-slide",
        };
      }
    } catch (_) { }
  }

  try {
    const { fetchSocialDownloader } = await import("./socialdownloader.js");
    const sdInfo = await fetchSocialDownloader(targetUrl, { isAudio, logger, timeout: 25000 });
    meta = sdInfo;
    if (Array.isArray(sdInfo.images) && sdInfo.images.length > 0) {
      sdInfo.images.forEach((img) => {
        const u = typeof img === "string" ? img : img.url || img.image || "";
        if (u) items.push({ type: "image", url: u });
      });
    }
    if (sdInfo.directVideoUrl || (!items.length && sdInfo.downloadUrl)) {
      items.push({ type: isAudio ? "audio" : "video", url: sdInfo.directVideoUrl || sdInfo.downloadUrl });
    }
    if (items.length > 0) {
      return {
        items,
        info: meta,
        source: "socialdownloader",
      };
    }
  } catch (_) { }

  if (/instagram\.com/i.test(targetUrl)) {
    try {
      const { downloadInstagram } = await import("./kolid.js");
      const kd = await downloadInstagram(targetUrl);
      if (Array.isArray(kd?.media) && kd.media.length > 0) {
        for (const m of kd.media) {
          items.push({
            type: m.type === "mp4" ? "video" : "image",
            url: m.url,
          });
        }
      }
      if (items.length > 0) {
        return {
          items,
          info: { title: kd.title, uploader: kd.username },
          source: "kol.id-carousel",
        };
      }
    } catch (_) { }
  }

  return { items, info: meta, source: "none" };
}

export function buildCaption(platform, info) {
  let out = `┌── ${platform.toUpperCase()} DOWNLOADER\n`;
  if (info?.title) out += `│ Judul: ${String(info.title).slice(0, 150)}\n`;
  if (info?.uploader || info?.author || info?.channel) {
    out += `│ Author: ${info.uploader || info.author || info.channel}\n`;
  }
  if (info?.duration) {
    const d = Number(info.duration);
    if (Number.isFinite(d) && d > 0) {
      const m = Math.floor(d / 60);
      const s = Math.floor(d % 60);
      out += `│ Durasi: ${m}m ${s}s\n`;
    } else if (info.duration) {
      out += `│ Durasi: ${info.duration}\n`;
    }
  }
  out += `└─`;
  return out;
}
