/**
 * Runner proses yt-dlp (probe metadata & unduh media).
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnYtDlp } from "./binary.js";

/** Ambil pesan error paling relevan dari stderr yt-dlp. */
export function cleanYtDlpError(stderr = "") {
  const lines = String(stderr)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"));
  const last = lines.at(-1);
  return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "") : "";
}

/**
 * Proses yt-dlp dengan batas waktu + abort signal.
 * @returns {{child: import("node:child_process").ChildProcess, cleanup: Function, timedOut: Function, timeoutError: Error}}
 */
export function guardedSpawn(args, timeoutMs, externalSignal) {
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

/**
 * Jalankan yt-dlp mode metadata (-J) lalu parse JSON-nya.
 * @returns {Promise<object>}
 */
export async function runJson(args, timeoutMs, signal) {
  const { child, spawnError, cleanup, timedOut, timeoutError } = guardedSpawn(args, timeoutMs, signal);
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

/**
 * Jalankan yt-dlp mode unduh, lalu baca hasilnya sebagai Buffer.
 * @returns {Promise<{filepath: string, buffer: Buffer}>}
 */
export async function runDownload(args, timeoutMs, signal) {
  const { child, spawnError, cleanup, timedOut, timeoutError } = guardedSpawn(args, timeoutMs, signal);
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
        if (
          path.isAbsolute(trimmed) &&
          !trimmed.endsWith(".part") &&
          !trimmed.endsWith(".ytdl") &&
          fs.existsSync(trimmed)
        ) {
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
        const existing = matches.filter((l) => fs.existsSync(l));
        if (existing.length > 0) {
          filepath = existing[existing.length - 1];
        } else if (matches.length > 0) {
          filepath = matches[matches.length - 1];
        }
      }

      if (!filepath) {
        return reject(new Error("File hasil download tidak ditemukan."));
      }

      try {
        const buffer = await fsp.readFile(filepath);
        await fsp.unlink(filepath).catch(() => {});
        resolve({ filepath, buffer });
      } catch (err) {
        discard();
        reject(err);
      }
    });
  });
}
