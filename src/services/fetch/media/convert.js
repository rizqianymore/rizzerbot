import sharp from "sharp";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath } from "./ffmpeg.js";
import { createSticker } from "./sticker.js";

const execFileAsync = promisify(execFile);

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
