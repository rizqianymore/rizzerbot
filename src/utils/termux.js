import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

const TERMUX_PREFIX = process.env.PREFIX || "/data/data/com.termux/files/usr";

export function isAndroid() {
  return (
    process.platform === "android" ||
    !!process.env.TERMUX_VERSION ||
    fs.existsSync("/data/data/com.termux/files/usr/bin/ffmpeg") ||
    (process.env.PREFIX || "").includes("com.termux")
  );
}

export function isTermux() {
  return (
    !!process.env.TERMUX_VERSION ||
    (process.env.PREFIX || "").includes("com.termux") ||
    fs.existsSync("/data/data/com.termux/files") ||
    process.platform === "android"
  );
}

export function isLowMemoryDevice() {
  try {
    const total = os.totalmem();
    if (total > 0 && total < 3 * 1024 * 1024 * 1024) return true;
  } catch (_) {}
  return isTermux() || isAndroid();
}

function existsExecutable(p) {
  try {
    if (!p || !fs.existsSync(p)) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function commandOnPath(cmd) {
  try {
    const res = spawnSync(cmd, ["-version"], { stdio: "ignore", timeout: 8000 });
    if (!res.error && res.status === 0) return cmd;
  } catch (_) {}
  try {
    const which = process.platform === "win32" ? "where" : "command";
    const args = process.platform === "win32" ? [cmd] : ["-v", cmd];
    const res = spawnSync(which, args, { encoding: "utf-8", timeout: 8000 });
    const out = String(res.stdout || "")
      .split("\n")[0]
      .trim();
    if (res.status === 0 && out && existsExecutable(out)) return out;
  } catch (_) {}
  return null;
}

export function ffmpegCandidates() {
  const list = [];
  if (process.env.FFMPEG_PATH) list.push(process.env.FFMPEG_PATH);
  list.push(
    path.join(process.cwd(), "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    path.join(TERMUX_PREFIX, "bin", "ffmpeg"),
    "/data/data/com.termux/files/usr/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    path.join(os.homedir(), ".termux", "bin", "ffmpeg")
  );
  return [...new Set(list.filter(Boolean))];
}

export function resolveFfmpegPath() {
  for (const p of ffmpegCandidates()) {
    if (existsExecutable(p)) return p;
  }
  const onPath = commandOnPath("ffmpeg");
  if (onPath) return onPath;
  return "ffmpeg";
}

export function ffmpegAvailable() {
  const p = resolveFfmpegPath();
  if (p !== "ffmpeg" && existsExecutable(p)) return true;
  try {
    execFileSync(p, ["-version"], { stdio: "ignore", timeout: 8000 });
    return true;
  } catch (_) {
    return false;
  }
}

export function termuxInstallHint() {
  return "Jalankan: pkg update && pkg install nodejs ffmpeg python yt-dlp libvips";
}
