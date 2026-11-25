import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath } from "./ffmpeg.js";
import { ffmpegStreamConvert } from "./stream.js";
import { getSharp } from "@/src/utils/native.js";
import { createSticker } from "./sticker.js";

const execFileAsync = promisify(execFile);

async function ffmpegConvert(inputBuffer, inputExt, outputExt, extraArgs = []) {
  // Coba stream in-memory dulu untuk format umum tanpa menulis ke disk
  if (outputExt === "mp3") {
    try {
      return await ffmpegStreamConvert(inputBuffer, ["-vn", "-acodec", "libmp3lame", "-b:a", "128k", "-f", "mp3"]);
    } catch (_) { }
  } else if (outputExt === "png" && (inputExt === "webp" || inputExt === "jpg" || inputExt === "jpeg")) {
    try {
      return await ffmpegStreamConvert(inputBuffer, ["-vframes", "1", "-f", "image2pipe", "-vcodec", "png", ...extraArgs]);
    } catch (_) { }
  } else if (outputExt === "webp") {
    try {
      return await ffmpegStreamConvert(inputBuffer, ["-vcodec", "libwebp", "-f", "webp", ...extraArgs]);
    } catch (_) { }
  }

  // Fallback file disk jika format/codec membutuhkan multi-pass atau seekable file
  const cacheDir = path.join(process.cwd(), "assets", "cache");
  if (!fs.existsSync(cacheDir)) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (_) { }
  }
  const tmpBase = path.join(cacheDir, `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inFile = `${tmpBase}.${inputExt}`;
  const outFile = `${tmpBase}-out.${outputExt}`;
  await fsp.writeFile(inFile, inputBuffer);
  try {
    await execFileAsync(getFfmpegPath(), ["-y", "-i", inFile, ...extraArgs, outFile], {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await fsp.readFile(outFile);
  } finally {
    await fsp.unlink(inFile).catch(() => { });
    await fsp.unlink(outFile).catch(() => { });
  }
}

export async function webpToImage(buffer) {
  const sharp = getSharp();
  if (sharp) {
    try {
      return await sharp(buffer).png().toBuffer();
    } catch (_err) {
      throw new Error("Gagal mengkonversi stiker ke gambar");
    }
  }
  try {
    return await ffmpegConvert(buffer, "webp", "png");
  } catch (_err) {
    throw new Error("Gagal mengkonversi stiker ke gambar (sharp & ffmpeg tidak tersedia)");
  }
}

export async function webpToVideo(buffer) {
  // Coba stream in-memory langsung jika ffmpeg mendukung libwebp demux
  try {
    const directStream = await ffmpegStreamConvert(
      buffer,
      [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
      ],
      30000
    );
    if (directStream && directStream.length > 500) {
      return directStream;
    }
  } catch (_) {}

  const sharp = getSharp();
  let pages = 1;
  if (sharp) {
    try {
      const meta = await sharp(buffer, { animated: true }).metadata();
      pages = meta.pages || 1;
    } catch (err) {
      console.warn("[webpToVideo] gagal baca metadata:", err?.message || err);
      return null;
    }
  } else {
    try {
      const probe = await ffmpegConvert(buffer, "webp", "mp4", [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
      ]);
      return probe;
    } catch (err) {
      console.warn("[webpToVideo] error (tanpa sharp):", err?.message || err);
      return null;
    }
  }
  if (pages <= 1) {
    return null;
  }

  try {
    const cacheDir = path.join(process.cwd(), "assets", "cache");
    if (!fs.existsSync(cacheDir)) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
      } catch (_) { }
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
        "-framerate",
        "15",
        "-i",
        path.join(tmpDir, "frame_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags",
        "+faststart",
        outMp4,
      ]);

      return await fsp.readFile(outMp4);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }
  } catch (err) {
    console.warn("[webpToVideo] error:", err?.message || err);
    return null;
  }
}

export async function upscaleImage(buffer, scale = 2) {
  const sharp = getSharp();
  if (sharp) {
    try {
      const img = sharp(buffer);
      const meta = await img.metadata();
      const width = Math.round((meta.width || 500) * scale);
      const height = Math.round((meta.height || 500) * scale);
      return await img.resize(width, height, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
    } catch (_err) {
      throw new Error("Gagal memproses gambar");
    }
  }
  try {
    return await ffmpegConvert(buffer, "png", "png", ["-vf", `scale=iw*${scale}:ih*${scale}:flags=lanczos`]);
  } catch (_err) {
    throw new Error("Gagal memproses gambar (sharp & ffmpeg tidak tersedia)");
  }
}

export async function imageToWebp(buffer) {
  const sticker = await createSticker(buffer);
  return sticker;
}
