import fs from "fs";
import path from "path";

// Pastikan symlink alias '@' di node_modules tersedia untuk module resolver
const symlinkPath = path.join(process.cwd(), "node_modules", "@");
if (!fs.existsSync(symlinkPath)) {
  try {
    fs.symlinkSync(process.cwd(), symlinkPath, "junction");
  } catch (_) { }
}

// Auto load .env jika file .env ada
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

// Konfigurasi binary lokal ffmpeg jika tersedia
const binFfmpeg = path.join(process.cwd(), "bin", "ffmpeg");
if (fs.existsSync(binFfmpeg)) {
  process.env.FFMPEG_PATH = binFfmpeg;
}

import { startBot, logger } from "./src/core/connection.js";

// Inisialisasi bot utama
startBot()
  .then(async () => {
    try {
      const { autoRestoreSubBots } = await import("./src/services/subbot/subbot.js");
      await autoRestoreSubBots();
    } catch (_) { }
  })
  .catch((err) => {
    logger?.error?.("Fatal initialization error:", err);
  });

// Graceful Shutdown & Process Crash Traps
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

process.on("unhandledRejection", (reason) => {
  logger?.error?.("[Unhandled Rejection Trapped]", reason?.message || reason);
});

process.on("uncaughtException", (err) => {
  logger?.error?.("[Uncaught Exception Trapped]", err?.message || err);
});

export default startBot;
