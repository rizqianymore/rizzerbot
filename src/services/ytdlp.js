import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BIN_DIR = path.join(process.cwd(), "bin");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytDlpAssetName() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

function commandWorks(cmd, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: "ignore", timeout: 10_000 });
    } catch {
      resolve(false);
      return;
    }
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

let ensurePromise = null;

/**
 * Pastikan binary yt-dlp tersedia.
 * 1. Cek di PATH sistem
 * 2. Cek di local project `./bin/yt-dlp`
 * 3. Jika belum ada, download otomatis dari release GitHub resmi
 */
export async function ensureYtDlp(onStatus = () => {}) {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    if (await commandWorks("yt-dlp", ["--version"])) return "yt-dlp";

    const localBinary = path.join(
      BIN_DIR,
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
    );

    if (await commandWorks(localBinary, ["--version"])) return localBinary;

    onStatus("Mengunduh binary yt-dlp terbaru...");
    await fs.mkdir(BIN_DIR, { recursive: true });

    const assetUrl = `${RELEASE_BASE}/${ytDlpAssetName()}`;
    const res = await fetch(assetUrl, { redirect: "follow" });
    if (!res.ok || !res.body) {
      throw new Error(`Gagal mengunduh yt-dlp (${res.status} ${res.statusText})`);
    }

    const tmpPath = `${localBinary}.download`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpPath));
    await fs.chmod(tmpPath, 0o755);
    await fs.rename(tmpPath, localBinary);

    return localBinary;
  })();

  try {
    return await ensurePromise;
  } catch (err) {
    ensurePromise = null;
    throw err;
  }
}

function cleanYtDlpError(stderr = "") {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"));
  const last = lines.at(-1);
  return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "") : "";
}

/**
 * Probe URL dan ambil metadata (mirip Yoinks probe)
 */
export async function probe(url, options = {}) {
  const ytdlp = await ensureYtDlp(options.onStatus);
  return new Promise((resolve, reject) => {
    const child = spawn(
      ytdlp,
      ["-J", "--no-playlist", "--no-warnings", url],
      { signal: options.signal }
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(cleanYtDlpError(stderr) || `yt-dlp keluar dengan kode ${code}`)
        );
      }
      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch (err) {
        reject(new Error("Gagal parsing response metadata yt-dlp"));
      }
    });
  });
}

/**
 * Unduh media langsung ke file temporary dan return path serta buffer
 * Mode:
 * - 'video': ambil video kualitas terbaik yang bersuara (atau merge video+audio mp4)
 * - 'audio': extract audio mp3
 */
export async function downloadMedia(url, { mode = "video", quality = "720", onStatus = () => {}, signal } = {}) {
  const ytdlp = await ensureYtDlp(onStatus);
  const tmpDir = path.join(os.tmpdir(), "rizzerbot-ytdlp");
  await fs.mkdir(tmpDir, { recursive: true });

  const isAudio = mode === "audio";
  const outputTemplate = path.join(tmpDir, `dl-${Date.now()}-%(title).50s.%(ext)s`);

  const args = [
    url,
    "--no-playlist",
    "--no-warnings",
    "--no-quiet",
    "--print",
    "after_move:filepath",
    "--no-simulate",
    "-o",
    outputTemplate,
  ];

  if (isAudio) {
    args.push("-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    // Utamakan max resolution sesuai requested, fallback ke best available mp4
    const h = parseInt(quality) || 720;
    args.push(
      "-f",
      `bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`,
      "--merge-output-format",
      "mp4"
    );
  }

  // Tambahkan ffmpeg jika ada di system
  if (await commandWorks("ffmpeg", ["-version"])) {
    args.push("--ffmpeg-location", "ffmpeg");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlp, args, { signal });
    let stdout = "";
    let stderr = "";
    let filepath = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (path.isAbsolute(trimmed) && !trimmed.endsWith(".part") && !trimmed.endsWith(".ytdl")) {
          filepath = trimmed;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) {
        return reject(
          new Error(cleanYtDlpError(stderr) || `Download gagal (yt-dlp exit code ${code})`)
        );
      }

      if (!filepath) {
        // cari baris stdout yang mencantumkan path
        const matches = stdout.split("\n").map((l) => l.trim()).filter((l) => path.isAbsolute(l));
        if (matches.length > 0) {
          filepath = matches[matches.length - 1];
        }
      }

      if (!filepath) {
        return reject(new Error("File hasil download tidak ditemukan."));
      }

      try {
        const buffer = await fs.readFile(filepath);
        // hapus file temporary setelah dibaca ke memory
        await fs.unlink(filepath).catch(() => {});
        resolve({
          filepath,
          buffer,
          isAudio,
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
