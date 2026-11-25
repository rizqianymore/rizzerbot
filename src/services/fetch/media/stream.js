import { spawn } from "child_process";
import { getFfmpegPath } from "./ffmpeg.js";

/**
 * Konversi media FFmpeg langsung via RAM buffer / pipes (stdin -> stdout)
 * Menghilangkan latency disk I/O dan menjaga disk tetap bersih tanpa file sampah.
 *
 * @param {Buffer} inputBuffer
 * @param {string[]} args - FFmpeg arguments (tanpa '-i' dan file output)
 * @param {number} timeoutMs
 * @returns {Promise<Buffer>}
 */
export function ffmpegStreamConvert(inputBuffer, args = [], timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      return reject(new Error("ffmpegStreamConvert: inputBuffer kosong atau tidak valid"));
    }

    const ffmpegPath = getFfmpegPath();
    // Default pipes: baca dari stdin ('-i', 'pipe:0') dan keluarkan ke stdout ('pipe:1')
    const finalArgs = ["-y", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", ...args, "pipe:1"];

    const proc = spawn(ffmpegPath, finalArgs);
    const stdoutChunks = [];
    const stderrChunks = [];
    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try {
          proc.kill("SIGKILL");
        } catch (_) {}
        reject(new Error(`FFmpeg stream timeout setelah ${Math.round(timeoutMs / 1000)} detik`));
      }
    }, timeoutMs);

    proc.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });

    proc.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
    });

    proc.on("error", (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve(Buffer.concat(stdoutChunks));
        } else {
          const errText = Buffer.concat(stderrChunks).toString("utf-8").trim();
          reject(new Error(`FFmpeg exited with code ${code}: ${errText || "Unknown error"}`));
        }
      }
    });

    proc.stdin.on("error", (err) => {
      // Ignore EPIPE errors if ffmpeg finishes or exits early
      if (err.code !== "EPIPE") {
        console.warn("[ffmpegStreamConvert] stdin error:", err?.message || err);
      }
    });

    proc.stdin.end(inputBuffer);
  });
}
