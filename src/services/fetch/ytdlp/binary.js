/**
 * Resolusi binary yt-dlp.
 *
 * Urutan pencarian:
 *   1. YTDLP_PATH dari .env
 *   2. `yt-dlp` di PATH
 *   3. `python3 -m yt_dlp` / `python -m yt_dlp`
 *   4. binary lokal di ./bin (diunduh otomatis bila memungkinkan)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { request } from "@/src/utils/request.js";
import { isAndroid, isTermux } from "@/src/utils/termux.js";

const BIN_DIR = path.join(process.cwd(), "bin");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function ytDlpAssetName() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.arch === "arm64" || process.arch === "arm") return "yt-dlp_linux_aarch64";
  return "yt-dlp_linux";
}

export function commandWorks(cmd, args) {
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

export function localBinaryPath() {
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

/** Spawn yt-dlp dengan prefix yang sudah ditentukan. */
export function spawnYtDlp(args, options = {}) {
  const { cmd, prefix } = resolvedYtDlp || { cmd: "yt-dlp", prefix: [] };
  return spawn(cmd, [...prefix, ...args], options);
}
