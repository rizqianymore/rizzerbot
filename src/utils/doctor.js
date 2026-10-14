import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import { isTermux } from "./termux.js";
import { resolveFfmpegPath } from "./termux.js";

function probe(cmd, args, timeout = 8000) {
  try {
    const res = spawnSync(cmd, args, { stdio: "ignore", timeout });
    return !res.error && res.status === 0;
  } catch (_) {
    return false;
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

function diskCheck() {
  try {
    const st = fs.statfsSync(process.cwd());
    const free = Number(st.bfree) * Number(st.bsize);
    const ok = free >= 1024 * 1024 * 1024;
    return {
      name: `ruang disk tersisa (${formatBytes(free)})`,
      ok,
      hint: ok ? "" : "Bebaskan ruang (minimal 1 GB): hapus isi assets/cache dan snapshot lama di database/backups.",
    };
  } catch (_) {
    return { name: "ruang disk tersisa (tak terbaca)", ok: true, hint: "" };
  }
}

function memoryCheck() {
  try {
    const total = os.totalmem();
    const ok = total >= 2 * 1024 * 1024 * 1024;
    return {
      name: `RAM total (${formatBytes(total)})`,
      ok,
      hint: ok ? "" : "RAM kecil: wajib pakai npm run start:termux (browser mati) agar tidak OOM.",
    };
  } catch (_) {
    return { name: "RAM (tak terbaca)", ok: true, hint: "" };
  }
}

export function checkEnvironment() {
  const termux = isTermux();
  const nodeMajor = Number(process.versions.node.split(".")[0] || 0);

  const ffmpeg = resolveFfmpegPath();
  const ffmpegOk = ffmpeg !== "ffmpeg" || probe("ffmpeg", ["-version"]);

  const ytdlpBin = probe("yt-dlp", ["--version"]) || probe(process.env.YTDLP_PATH || "__unset__", ["--version"]);
  const ytdlpPy = probe("python3", ["-m", "yt_dlp", "--version"]) || probe("python", ["-m", "yt_dlp", "--version"]);
  const pythonOk = probe("python3", ["--version"]) || probe("python", ["--version"]);

  const core = [
    {
      name: `node >= 20 (kamu: ${process.versions.node})`,
      ok: nodeMajor >= 20,
      hint: termux ? "pkg install nodejs-lts" : "Install Node.js 20+.",
    },
    {
      name: `ffmpeg (${ffmpeg})`,
      ok: ffmpegOk,
      hint: termux ? "pkg install ffmpeg" : "Install ffmpeg.",
    },
    {
      name: "yt-dlp (binary / python module)",
      ok: ytdlpBin || ytdlpPy,
      hint: termux ? "pkg install yt-dlp  ATAU  pip install -U yt-dlp" : "Install yt-dlp atau: pip install -U yt-dlp.",
    },
  ];

  const optional = [
    {
      name: "python3 (sandbox --py)",
      ok: pythonOk,
      hint: termux ? "pkg install python" : "Install python3.",
    },
    {
      name: "tar (backup/restore)",
      ok: probe("tar", ["--version"]),
      hint: termux ? "pkg install tar" : "Install tar.",
    },
    diskCheck(),
    memoryCheck(),
  ];

  return { termux, core, optional, coreOk: core.every((c) => c.ok) };
}

export function formatDoctorReport(report) {
  const lines = [`Cek lingkungan${report.termux ? " (Termux terdeteksi)" : ""}:`];
  for (const c of report.core) lines.push(`  ${c.ok ? "OK  " : "FAIL"} ${c.name}${c.ok ? "" : `  -> ${c.hint}`}`);
  for (const c of report.optional)
    lines.push(`  ${c.ok ? "ok  " : "--  "} ${c.name} (opsional)${c.ok ? "" : `  -> ${c.hint}`}`);
  return lines.join("\n");
}
