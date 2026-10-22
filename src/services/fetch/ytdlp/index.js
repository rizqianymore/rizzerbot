/**
 * yt-dlp wrapper dengan eskalasi anti-protection.
 *
 * Tangga percobaan (murah -> mahal):
 *   1. direct                 — koneksi biasa, tanpa boros kuota
 *   2. + Bright Data Unlocker — request lewat native proxy Web Unlocker (44445)
 *   3. + cookie clearance     — challenge diselesaikan browser (lokal / Scraping Browser remote)
 *                                lalu cookie-nya dipakai yt-dlp via --cookies
 *
 * Eskalasi hanya terjadi bila error-nya memang indikasi proteksi, supaya
 * video yang memang tidak ada tidak ikut launching browser.
 */

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getBrightDataProxy } from "@/src/services/network/brightdata.js";
import { detectErrorProtection } from "@/src/services/network/scraper/detect.js";
import { resolveFfmpegPath } from "@/src/utils/termux.js";
import { commandWorks, ensureYtDlp } from "./binary.js";
import { resolveClearanceCookies } from "./cookies.js";
import { runDownload, runJson } from "./runner.js";

const PROBE_TIMEOUT_MS = 60000;
const DOWNLOAD_TIMEOUT_MS = 300000;

/** Error yang menandakan media memang tidak tersedia (bukan proteksi). */
const FATAL_MEDIA_PATTERNS = [
  /video unavailable/i,
  /this video is (not|private)/i,
  /private video/i,
  /has been removed/i,
  /video was removed/i,
  /members-only/i,
  /join this channel/i,
  /unsupported url/i,
  /no video formats found/i,
  /account associated with this video has been terminated/i,
];

/**
 * Apakah error ini indikasi proteksi (layak dinaikkan ke jalur unlocker)?
 */
export function isProtectionError(err) {
  const message = String(err?.message || err || "");
  if (FATAL_MEDIA_PATTERNS.some((re) => re.test(message))) return false;
  const protection = detectErrorProtection(err);
  if (protection.blocked) return true;
  return /unable to download (webpage|api page)/i.test(message);
}

/** Argumen proxy Bright Data (Web Unlocker native proxy). */
export function proxyArgs() {
  const proxy = getBrightDataProxy();
  return proxy ? ["--proxy", proxy] : [];
}

/**
 * Susun tangga eskalasi (dibuat lazy agar cookie hanya dicari saat dibutuhkan).
 * @returns {Array<{label: string, build: () => Promise<string[]|null>}>}
 */
function buildLadder(url, options = {}) {
  const proxy = getBrightDataProxy();
  const via = String(options.via || "auto").toLowerCase();
  const allowProxy = via !== "direct" && Boolean(proxy);
  const allowCookies = via !== "direct";

  const ladder = [
    {
      label: "direct",
      build: async () => (via === "brightdata" || via === "unlocker" ? null : []),
    },
  ];

  if (allowProxy) {
    ladder.push({
      label: "unlocker",
      build: async () => ["--proxy", proxy],
    });
  }

  if (allowCookies) {
    ladder.push({
      label: "cookies",
      build: async () => {
        const info = await resolveClearanceCookies(url, { logger: options.logger });
        if (!info?.file) return null;
        const args = ["--cookies", info.file];
        if (allowProxy) args.push("--proxy", proxy);
        return args;
      },
    });
  }

  return ladder;
}

/**
 * Jalankan satu rangkaian argumen pada yt-dlp, dengan eskalasi otomatis.
 * @param {(args: string[]) => Promise<any>} run
 */
async function runWithEscalation(url, run, options = {}) {
  const ladder = buildLadder(url, options);
  let lastError = null;

  for (const step of ladder) {
    const extra = await step.build();
    if (!extra) continue;
    try {
      const result = await run(extra);
      if (typeof options.onVia === "function") {
        try {
          options.onVia(step.label);
        } catch (_) {}
      }
      return result;
    } catch (err) {
      lastError = err;
      if (!isProtectionError(err)) throw err;
      options.logger?.warn?.(`[ytdlp] ${step.label} kena proteksi, naik ke jalur berikutnya: ${err?.message || err}`);
    }
  }

  throw lastError || new Error("yt-dlp gagal tanpa pesan error");
}

/**
 * Ambil metadata media (mode -J).
 * @returns {Promise<object>}
 */
export async function probe(url, options = {}) {
  await ensureYtDlp(options.onStatus);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : PROBE_TIMEOUT_MS;

  return runWithEscalation(
    url,
    (extra) => runJson(["-J", "--no-playlist", "--no-warnings", ...extra, url], timeoutMs, options.signal),
    options
  );
}

/**
 * Unduh media (video/audio) lewat yt-dlp.
 * @returns {Promise<{filepath: string, buffer: Buffer, isAudio: boolean}>}
 */
export async function downloadMedia(
  url,
  { mode = "video", quality = "720", onStatus = () => {}, signal, timeoutMs, logger, via, onVia } = {}
) {
  await ensureYtDlp(onStatus);
  const tmpDir = path.join(os.tmpdir(), "rizzerbot-ytdlp");
  await fsp.mkdir(tmpDir, { recursive: true });

  const isAudio = mode === "audio";
  const outputTemplate = path.join(tmpDir, `dl-${Date.now()}-%(title).50s.%(ext)s`);

  const buildArgs = async (extra) => {
    const args = [
      url,
      "--no-playlist",
      "--no-warnings",
      "--no-quiet",
      "--print",
      "after_move:filepath",
      "--no-simulate",
      ...extra,
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
    } else if (await commandWorks("ffmpeg", ["--version"])) {
      args.push("--ffmpeg-location", "ffmpeg");
    }

    return args;
  };

  const limit = Number(timeoutMs) > 0 ? Number(timeoutMs) : DOWNLOAD_TIMEOUT_MS;
  const result = await runWithEscalation(url, async (extra) => runDownload(await buildArgs(extra), limit, signal), {
    logger,
    via,
    onVia,
  });

  return { filepath: result.filepath, buffer: result.buffer, isAudio };
}

export { ensureYtDlp };
export default { probe, downloadMedia, ensureYtDlp, isProtectionError };
