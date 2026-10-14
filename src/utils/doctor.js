import { spawnSync } from "child_process";
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
