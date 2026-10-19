import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { request } from "@/src/utils/request.js";
import { getBrightDataProxy } from "@/src/services/network/brightdata.js";
import { isAndroid, isTermux, resolveFfmpegPath } from "@/src/utils/termux.js";

const BIN_DIR = path.join(process.cwd(), "bin");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytDlpAssetName() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.arch === "arm64" || process.arch === "arm") return "yt-dlp_linux_aarch64";
  return "yt-dlp_linux";
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

function localBinaryPath() {
  return path.join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
}

async function removeBrokenBinary(p) {
  try {
    await fsp.unlink(p);
  } catch (_) {}
  try {
    await fsp.unlink(`${p}.download`);
  } catch (_) {}
}

let resolvedYtDlp = null;
let ensurePromise = null;

async function resolveCommand() {
  if (process.env.YTDLP_PATH) {
    const custom = process.env.YTDLP_PATH;
    if (await commandWorks(custom, ["--version"])) return { cmd: custom, prefix: [] };
  }

  if (await commandWorks("yt-dlp", ["--version"])) return { cmd: "yt-dlp", prefix: [] };

  if (await commandWorks("python3", ["-m", "yt_dlp", "--version"])) {
    return { cmd: "python3", prefix: ["-m", "yt_dlp"] };
  }
  if (await commandWorks("python", ["-m", "yt_dlp", "--version"])) {
    return { cmd: "python", prefix: ["-m", "yt_dlp"] };
  }

  return null;
}

export async function ensureYtDlp(onStatus = () => {}) {
  if (resolvedYtDlp) return resolvedYtDlp.cmd;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const sys = await resolveCommand();
    if (sys) {
      resolvedYtDlp = sys;
      return sys.cmd;
    }

    const localBinary = localBinaryPath();
    if (fs.existsSync(localBinary)) {
      if (await commandWorks(localBinary, ["--version"])) {
        resolvedYtDlp = { cmd: localBinary, prefix: [] };
        return localBinary;
      }
      await removeBrokenBinary(localBinary);
    }

    if (isAndroid() || isTermux()) {
      throw new Error(
        "yt-dlp tidak ditemukan dan binary Linux tidak bisa jalan di Android. " +
          "Di Termux jalankan: pkg install yt-dlp  ATAU  pip install -U yt-dlp, lalu coba lagi."
      );
    }

    onStatus("Mengunduh binary yt-dlp terbaru...");
    await fsp.mkdir(BIN_DIR, { recursive: true });

    const assetUrl = `${RELEASE_BASE}/${ytDlpAssetName()}`;
    const buf = await request.buffer(assetUrl, { timeout: 120000, retries: 1 });
    if (!buf?.length) {
      throw new Error("Gagal mengunduh yt-dlp (respons kosong)");
    }

    const tmpPath = `${localBinary}.download`;
    await fsp.writeFile(tmpPath, buf);
    await fsp.chmod(tmpPath, 0o755);
    await fsp.rename(tmpPath, localBinary);

    if (!(await commandWorks(localBinary, ["--version"]))) {
      await removeBrokenBinary(localBinary);
      throw new Error(
        "Binary yt-dlp yang diunduh tidak bisa dijalankan di perangkat ini. Coba install via pip: pip install -U yt-dlp"
      );
    }

    resolvedYtDlp = { cmd: localBinary, prefix: [] };
    return localBinary;
  })();

  try {
    return await ensurePromise;
  } catch (err) {
    ensurePromise = null;
    throw err;
  }
}

function spawnYtDlp(args, options = {}) {
  const { cmd, prefix } = resolvedYtDlp || { cmd: "yt-dlp", prefix: [] };
  return spawn(cmd, [...prefix, ...args], options);
}

function cleanYtDlpError(stderr = "") {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"));
  const last = lines.at(-1);
  return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "") : "";
}

const PROBE_TIMEOUT_MS = 60000;
const DOWNLOAD_TIMEOUT_MS = 300000;

function proxyArgs() {
  const proxy = getBrightDataProxy();
  return proxy ? ["--proxy", proxy] : [];
}

function guardedSpawn(args, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (timer.unref) timer.unref();

  let child = null;
  let spawnError = null;
  try {
    child = spawnYtDlp(args, { signal: controller.signal, killSignal: "SIGKILL" });
  } catch (err) {
    spawnError = err;
  }

  const cleanup = () => {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", forwardAbort);
  };
  const timedOut = () => controller.signal.aborted && !externalSignal?.aborted;

  return { child, spawnError, cleanup, timedOut, timeoutError: new Error("Proses yt-dlp melebihi batas waktu") };
}

export async function probe(url, options = {}) {
  await ensureYtDlp(options.onStatus);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : PROBE_TIMEOUT_MS;
  const { child, spawnError, cleanup, timedOut, timeoutError } = guardedSpawn(
    ["-J", "--no-playlist", "--no-warnings", ...proxyArgs(), url],
    timeoutMs,
    options.signal
  );
  if (spawnError) {
    cleanup();
    throw spawnError;
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err) => {
      cleanup();
      reject(timedOut() ? timeoutError : err);
    });
    child.on("close", (code) => {
      cleanup();
      if (timedOut()) return reject(timeoutError);
      if (code !== 0) {
        return reject(new Error(cleanYtDlpError(stderr) || `yt-dlp keluar dengan kode ${code}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (_err) {
        reject(new Error("Gagal parsing response metadata yt-dlp"));
      }
    });
  });
}

export async function downloadMedia(
  url,
  { mode = "video", quality = "720", onStatus = () => {}, signal, timeoutMs } = {}
) {
  await ensureYtDlp(onStatus);
  const tmpDir = path.join(os.tmpdir(), "rizzerbot-ytdlp");
  await fsp.mkdir(tmpDir, { recursive: true });

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
    ...proxyArgs(),
    "-o",
    outputTemplate,
  ];

  if (isAudio) {
    args.push("-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    const h = parseInt(quality) || 720;
    args.push("-f", `bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`, "--merge-output-format", "mp4");
  }

  const ffmpegPath = resolveFfmpegPath();
  if (ffmpegPath && ffmpegPath !== "ffmpeg") {
    args.push("--ffmpeg-location", ffmpegPath);
  } else if (await commandWorks("ffmpeg", ["-version"])) {
    args.push("--ffmpeg-location", "ffmpeg");
  }

  const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : DOWNLOAD_TIMEOUT_MS;
  const { child, spawnError, cleanup, timedOut, timeoutError } = guardedSpawn(args, limit, signal);
  if (spawnError) {
    cleanup();
    throw spawnError;
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let filepath = "";

    const discard = () => {
      if (filepath) fsp.unlink(filepath).catch(() => {});
    };

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

    child.on("error", (err) => {
      cleanup();
      reject(timedOut() ? timeoutError : err);
    });
    child.on("close", async (code) => {
      cleanup();
      if (timedOut()) {
        discard();
        return reject(timeoutError);
      }
      if (code !== 0) {
        discard();
        return reject(new Error(cleanYtDlpError(stderr) || `Download gagal (yt-dlp exit code ${code})`));
      }

      if (!filepath) {
        const matches = stdout
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => path.isAbsolute(l));
        if (matches.length > 0) {
          filepath = matches[matches.length - 1];
        }
      }

      if (!filepath) {
        return reject(new Error("File hasil download tidak ditemukan."));
      }

      try {
        const buffer = await fsp.readFile(filepath);
        await fsp.unlink(filepath).catch(() => {});
        resolve({
          filepath,
          buffer,
          isAudio,
        });
      } catch (err) {
        discard();
        reject(err);
      }
    });
  });
}
