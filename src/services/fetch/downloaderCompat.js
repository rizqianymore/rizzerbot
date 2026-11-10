import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { resolveFfmpegPath } from "@/src/utils/termux.js";
import { isVideoOrAnimated } from "./media/buffer.js";

const execFileAsync = promisify(execFile);

// deteksi tipe via magic bytes
export function detectMediaType(buffer) {
  if (!buffer || buffer.length < 4) return "unknown";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image"; // jpeg
  if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return "image";
  if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return "image"; // webp may be animated
  if (buffer.slice(0, 3).toString() === "GIF") return "image";
  if (isVideoOrAnimated(buffer)) {
    // cek webm/mkv via EBML
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "video"; // webm/mkv
    return "video";
  }
  // mp3 id3
  if (buffer.slice(0, 3).toString() === "ID3") return "audio";
  // mp4 ftyp
  if (buffer.slice(4, 8).toString() === "ftyp") return "video";
  // ogg
  if (buffer.slice(0, 4).toString() === "OggS") return "audio";
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
  const cacheDir = path.join(os.tmpdir(), "rizzerbot-compat");
  await fsp.mkdir(cacheDir, { recursive: true }).catch(() => {});
  const base = path.join(cacheDir, `cvt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inFile = `${base}.${inputExt}`;
  const outFile = `${base}.${outputExt}`;
  await fsp.writeFile(inFile, inputBuffer);
  try {
    await execFileAsync(resolveFfmpegPath(), ["-y", "-i", inFile, ...extraArgs, outFile], {
      timeout: 80000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return await fsp.readFile(outFile);
  } finally {
    await fsp.unlink(inFile).catch(() => {});
    await fsp.unlink(outFile).catch(() => {});
  }
}

export async function ensureVideoCompatible(buffer) {
  if (!buffer || buffer.length < 100) return buffer;
  const type = detectMediaType(buffer);
  // sudah mp4 yang valid, coba kirim langsung dulu, ffmpeg hanya jika perlu
  // Heuristic: coba transcode selalu ke mp4 h264+aac biar pasti kebuka di WA
  // Tapi hindari transcode image yang terdeteksi video (gif)
  if (type === "image" && buffer.slice(0, 4).toString() !== "RIFF") {
    // image tapi mode video -> biarkan, nanti dikirim sebagai image
    return buffer;
  }
  try {
    // deteksi ext input via sniff
    let inputExt = "mp4";
    if (buffer[0] === 0x1a && buffer[1] === 0x45) inputExt = "webm";
    else if (buffer.slice(4, 8).toString() === "ftyp") inputExt = "mp4";
    else if (buffer.slice(0, 3).toString() === "GIF") inputExt = "gif";
    else inputExt = "bin";

    const out = await ffmpegConvertBuffer(buffer, inputExt, "mp4", [
      "-c:v",
      "libx264",
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
  try {
    let inputExt = "bin";
    if (buffer.slice(0, 3).toString() === "ID3") inputExt = "mp3";
    else if (buffer.slice(0, 4).toString() === "OggS") inputExt = "ogg";
    else if (buffer.slice(4, 8).toString() === "ftyp") inputExt = "m4a";
    const out = await ffmpegConvertBuffer(buffer, inputExt, "mp3", ["-c:a", "libmp3lame", "-q:a", "2"]);
    return out && out.length > 100 ? out : buffer;
  } catch (_) {
    return buffer;
  }
}

export function isProbablyPlayable(buffer, mode) {
  const t = detectMediaType(buffer);
  if (mode === "audio") return t === "audio" || t === "video"; // video dengan audio track juga bisa
  if (mode === "video") return t === "video" || t === "image"; // gif masuk image
  return true;
}

// Unified downloader: socialdownloader -> kol.id -> ytdlp, auto convert
export async function unifiedDownload(url, { mode = "video", logger, timeoutMs = 60000 } = {}) {
  const isAudio = mode === "audio";
  let lastErr = null;
  let rawBuffer = null;
  let info = null;
  let source = "";

  // 0) Web Unlocker Engine (khusus TikTok via Snaptik / TikWM)
  if (/tiktok\.com|douyin\.com/i.test(String(url))) {
    try {
      const { downloadViaSnaptik } = await import("./snaptik.js");
      const snap = await downloadViaSnaptik(url, { isAudio });
      if (snap?.buffer?.length > 100) {
        rawBuffer = snap.buffer;
        info = snap.info;
        source = snap.source || "web-unlocker";
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat web-unlocker] ${err?.message || err}`);
    }
  }

  // 1) SocialDownloader (cepat, support banyak platform)
  if (!rawBuffer) {
    try {
      const { downloadSocialMedia } = await import("./socialdownloader.js");
      const sd = await downloadSocialMedia(url, { isAudio, logger, timeout: 30000 });
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

  // 2) Kol.id (khusus TikTok / Instagram / YouTube bila SocialDownloader gagal/limit)
  if (!rawBuffer) {
    try {
      const lower = String(url).toLowerCase();
      const { request } = await import("@/src/utils/request.js");
      if (/tiktok\.com/i.test(lower)) {
        const { downloadTiktok } = await import("./kolid.js");
        const kd = await downloadTiktok(url);
        const targetDl = isAudio ? kd?.mp3 : (kd?.noWatermark || kd?.watermark);
        if (targetDl) {
          const buf = await request.buffer(targetDl, { timeout: 35000, bypassCloudflare: "auto" });
          if (buf?.length > 100) {
            rawBuffer = buf;
            info = { title: kd.title, uploader: kd.author, duration: kd.duration };
            source = "kol.id";
          }
        }
      } else if (/instagram\.com/i.test(lower)) {
        const { downloadInstagram } = await import("./kolid.js");
        const kd = await downloadInstagram(url);
        const firstMedia = kd?.media?.[0]?.url;
        if (firstMedia) {
          const buf = await request.buffer(firstMedia, { timeout: 35000, bypassCloudflare: "auto" });
          if (buf?.length > 100) {
            rawBuffer = buf;
            info = { title: kd.title, uploader: kd.username };
            source = "kol.id";
          }
        }
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat kol.id] ${err?.message || err}`);
    }
  }

  // 3) yt-dlp (paling stabil & komprehensif, support >1000 site)
  if (!rawBuffer) {
    try {
      const { downloadMedia, probe } = await import("./ytdlp.js");
      const pInfo = await probe(url, { timeoutMs: 20000 }).catch(() => null);
      const dl = await downloadMedia(url, { mode: isAudio ? "audio" : "video", timeoutMs });
      if (dl?.buffer?.length > 100) {
        rawBuffer = dl.buffer;
        info = pInfo || info;
        source = "yt-dlp";
      }
    } catch (err) {
      lastErr = err;
      logger?.warn?.(`[compat ytdlp] ${err?.message || err}`);
    }
  }

  if (!rawBuffer) {
    throw lastErr || new Error("Gagal mengunduh media dari semua engine (socialdownloader, kol.id & yt-dlp).");
  }

  // 3) Auto convert biar bisa dibuka di WA
  let buffer = rawBuffer;
  if (isAudio) {
    // jika buffer ternyata video (yt-dlp kadang balikin mp4 walau mode audio), convert ke mp3
    const t = detectMediaType(buffer);
    if (t === "video") {
      buffer = await ensureAudioCompatible(buffer);
    } else if (t !== "audio") {
      // coba convert juga
      const conv = await ensureAudioCompatible(buffer);
      if (conv) buffer = conv;
    }
  } else {
    const t = detectMediaType(buffer);
    if (t === "video" || t === "unknown") {
      // pastikan mp4 playable
      const conv = await ensureVideoCompatible(buffer);
      // hanya pakai hasil convert kalau memang valid video
      if (conv && conv.length > 100) buffer = conv;
    } else if (t === "audio") {
      // mode video tapi dapet audio -> biarin, nanti kirim sebagai audio
    }
  }

  return { buffer, info, source, rawBuffer };
}

export function buildCaption(platform, info) {
  const lines = [`*${platform.toUpperCase()} DOWNLOADER*`];
  if (info?.title) lines.push(`Judul: ${String(info.title).slice(0, 150)}`);
  if (info?.uploader || info?.author || info?.channel) lines.push(`Author: ${info.uploader || info.author || info.channel}`);
  if (info?.duration) {
    const d = Number(info.duration);
    if (Number.isFinite(d) && d > 0) {
      const m = Math.floor(d / 60);
      const s = Math.floor(d % 60);
      lines.push(`Durasi: ${m}m ${s}s`);
    } else if (info.duration) lines.push(`Durasi: ${info.duration}`);
  }
  return lines.join("\n");
}
