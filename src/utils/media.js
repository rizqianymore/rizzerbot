import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execPromise = promisify(exec);

/**
 * Transcodes a video buffer to a highly compatible H.264/AAC MP4 format for WhatsApp.
 * @param {Buffer} videoBuffer - Raw input video buffer
 * @returns {Promise<Buffer>} - Transcoded or fallback original video buffer
 */
export async function transcodeToWhatsappVideo(videoBuffer) {
  const rawFilename = `raw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
  const rawPath = path.join(process.cwd(), "database", rawFilename);
  const transFilename = `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
  const transPath = path.join(process.cwd(), "database", transFilename);

  try {
    fs.writeFileSync(rawPath, videoBuffer);
    const localFfmpeg = path.join(process.cwd(), "bin", "ffmpeg");
    const ffmpegPath = fs.existsSync(localFfmpeg) ? `"${localFfmpeg}"` : "ffmpeg";
    
    // Transcode video to:
    // -c:v libx264 (H.264 video codec)
    // -pix_fmt yuv420p (standard YUV color space compatible with Android/iOS/web)
    // -c:a aac (AAC audio codec, widely supported)
    // -map 0:v -map 0:a? (optional audio stream mapping)
    const cmd = `${ffmpegPath} -y -i "${rawPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -map 0:v -map 0:a? "${transPath}"`;
    await execPromise(cmd);

    if (fs.existsSync(transPath) && fs.statSync(transPath).size > 0) {
      const transcodedBuffer = fs.readFileSync(transPath);
      return transcodedBuffer;
    }
    return videoBuffer;
  } catch (err) {
    console.error("Video transcoding utility failed:", err.message);
    return videoBuffer;
  } finally {
    try {
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      if (fs.existsSync(transPath)) fs.unlinkSync(transPath);
    } catch (_) {}
  }
}

/**
 * Converts a static WebP buffer into a PNG image buffer.
 * @param {Buffer} webpBuffer - WebP buffer
 * @returns {Promise<Buffer>} - PNG buffer
 */
export async function webpToImage(webpBuffer) {
  const sharp = (await import("sharp")).default;
  return await sharp(webpBuffer).png().toBuffer();
}

/**
 * Converts an animated WebP buffer into an MP4 video buffer.
 * @param {Buffer} webpBuffer - Animated WebP buffer
 * @returns {Promise<Buffer>} - MP4 video buffer
 */
export async function animatedWebpToMp4(webpBuffer) {
  const rawFilename = `raw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
  const rawPath = path.join(process.cwd(), "database", rawFilename);
  const outFilename = `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
  const outPath = path.join(process.cwd(), "database", outFilename);

  try {
    fs.writeFileSync(rawPath, webpBuffer);
    const localFfmpeg = path.join(process.cwd(), "bin", "ffmpeg");
    const ffmpegPath = fs.existsSync(localFfmpeg) ? `"${localFfmpeg}"` : "ffmpeg";

    const cmd = `${ffmpegPath} -y -i "${rawPath}" -c:v libx264 -pix_fmt yuv420p -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" "${outPath}"`;
    await execPromise(cmd);

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      return fs.readFileSync(outPath);
    }
    return webpBuffer;
  } catch (err) {
    console.error("Animated WebP to MP4 conversion failed:", err.message);
    return webpBuffer;
  } finally {
    try {
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (_) {}
  }
}

