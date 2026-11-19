import "./src/utils/log-filter.js";
import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) { }
import fs from "fs";
import path from "path";

// Pastikan alias scoping @ (src, config, custom) ada tanpa circular symlink ke root node_modules
try {
  const atDir = path.join(process.cwd(), "node_modules", "@");
  if (fs.existsSync(atDir) && fs.lstatSync(atDir).isSymbolicLink()) {
    fs.unlinkSync(atDir);
  }
  if (!fs.existsSync(atDir)) {
    fs.mkdirSync(atDir, { recursive: true });
  }
  for (const t of ["src", "config", "custom"]) {
    const linkPath = path.join(atDir, t);
    if (!fs.existsSync(linkPath)) {
      try {
        fs.symlinkSync(path.join("..", "..", t), linkPath, process.platform === "win32" ? "junction" : "dir");
      } catch (_) { }
    }
  }

  // Bersihkan folder orphan .node_modules-* jika pernah terbuat oleh npm
  const cwdFiles = fs.readdirSync(process.cwd());
  for (const f of cwdFiles) {
    if (f.startsWith(".node_modules-")) {
      try {
        fs.rmSync(path.join(process.cwd(), f), { recursive: true, force: true });
      } catch (_) { }
    }
  }
} catch (_) { }

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (_) { }
}

const termuxPrefix = process.env.PREFIX || "/data/data/com.termux/files/usr";
const candidateFfmpegPaths = [
  process.env.FFMPEG_PATH,
  path.join(process.cwd(), "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
  path.join(termuxPrefix, "bin", "ffmpeg"),
  "/data/data/com.termux/files/usr/bin/ffmpeg",
  "/usr/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/opt/homebrew/bin/ffmpeg",
];
function isExecutableFile(p) {
  try {
    if (!p || !fs.existsSync(p)) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
for (const p of candidateFfmpegPaths) {
  if (p && isExecutableFile(p)) {
    process.env.FFMPEG_PATH = p;
    const dir = path.dirname(p);
    if (!process.env.PATH.split(path.delimiter).includes(dir)) {
      process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
    }
    break;
  }
}

const { startBot, logger } = await import("./src/core/connection.js");

try {
  const { stealthBrowser } = await import("./src/utils/request/browser.js");
  stealthBrowser.setLogger?.(logger);
} catch (_) { }

try {
  const { checkEnvironment, formatDoctorReport } = await import("./src/utils/doctor.js");
  const report = await checkEnvironment();
  if (!report.coreOk) {
    logger?.warn?.(`[Doctor] Ada dependensi inti yang hilang:\n${formatDoctorReport(report)}`);
  }
} catch (_) { }

startBot()
  .then(async () => {
    try {
      const { autoRestoreSubBots, syncSubBotsDatabase } = await import("./src/services/system/subbot/subbot.js");
      await syncSubBotsDatabase();
      await autoRestoreSubBots();
    } catch (_) { }
    try {
      const { startExpiryCron } = await import("./src/services/system/expiry.js");
      startExpiryCron(logger);
    } catch (_) { }
    try {
      const { startBackupCron } = await import("./src/services/system/backup-cron.js");
      startBackupCron(logger);
    } catch (_) { }
    try {
      const { startActiveCheck } = await import("./src/services/system/active-check.js");
      startActiveCheck(logger);
    } catch (_) { }
    try {
      const { startHealthServer } = await import("./src/services/system/health-server.js");
      startHealthServer(logger);
    } catch (_) { }
  })
  .catch((err) => {
    logger?.error?.("Fatal initialization error:", err);
  });

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger?.info?.(`[System] Received ${signal}. Saving data and gracefully shutting down...`);
  try {
    const { cleanOrphanChromeProcesses } = await import("./src/utils/cleaner.js");
    cleanOrphanChromeProcesses(logger);
  } catch (_) { }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", async (reason) => {
  try {
    const { shouldSuppressLog } = await import("./src/utils/log-filter.js");
    if (shouldSuppressLog(reason)) return;
  } catch (_) { }
  logger?.error?.("[Unhandled Rejection Trapped]", reason?.message || reason);
});

process.on("uncaughtException", async (err) => {
  try {
    const { shouldSuppressLog } = await import("./src/utils/log-filter.js");
    if (shouldSuppressLog(err)) return;
  } catch (_) { }
  logger?.error?.("[Uncaught Exception Trapped]", err?.message || err);
});

export default startBot;
