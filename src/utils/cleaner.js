import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function cleanRootJunkFiles() {
  const rootDir = path.join(__dirname, "..", "..");
  const junkRegex =
    /^(actual_f\d+|anim|dump_fr_\w+|f\d+|fr_\d+|frame_actual|mp4_frame_\d+|output_actual_\w+|sharp_fr_\d+|test_\w+)\.(png|webp|mp4|jpg|jpeg|gif)$/i;
  const junkTxtRegex = /^(man|manifest)\.txt$/i;

  let count = 0;
  let bytes = 0;

  try {
    const files = fs.readdirSync(rootDir);
    for (const file of files) {
      if (junkRegex.test(file) || junkTxtRegex.test(file)) {
        const filePath = path.join(rootDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            bytes += stat.size || 0;
            fs.unlinkSync(filePath);
            count++;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return { count, bytes };
}

export function cleanTempFiles({ maxAgeMs = 2 * 60 * 60 * 1000 } = {}) {
  const pathsToClean = [
    path.join(__dirname, "..", "..", "assets", "sessions", "primary_bot"),
    path.join(__dirname, "..", "..", "assets", "sessions"),
    path.join(__dirname, "..", "..", "assets", "media"),
    path.join(__dirname, "..", "..", "assets", "cache"),
    path.join(__dirname, "..", "..", "temp"),
    path.join(__dirname, "..", "..", "tmp"),
  ];

  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  // 1. Clean root junk files
  const rootClean = cleanRootJunkFiles();
  deletedCount += rootClean.count;
  freedBytes += rootClean.bytes;

  const isTempSessionFile = (name) => {
    return (
      name.endsWith(".json") &&
      (name.startsWith("pre-key-") ||
        name.startsWith("app-state-sync-key-") ||
        name.startsWith("sender-key-") ||
        name.startsWith("session-"))
    );
  };

  const isTrashFile = (name) => {
    return (
      name.endsWith(".tmp") ||
      name.endsWith(".temp") ||
      name.endsWith(".log") ||
      name.startsWith("temp_")
    );
  };

  for (const basePath of pathsToClean) {
    if (!fs.existsSync(basePath)) continue;

    const isCacheDir = basePath.endsWith(path.join("assets", "cache"));

    try {
      const items = fs.readdirSync(basePath);
      for (const item of items) {
        const itemPath = path.join(basePath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && item.startsWith("session_")) {
          try {
            const subFiles = fs.readdirSync(itemPath);
            for (const subFile of subFiles) {
              if (isTempSessionFile(subFile) || isTrashFile(subFile)) {
                const filePath = path.join(itemPath, subFile);
                const fileStat = fs.statSync(filePath);
                if (maxAgeMs <= 0 || now - fileStat.mtimeMs > maxAgeMs) {
                  freedBytes += fileStat.size || 0;
                  fs.unlinkSync(filePath);
                  deletedCount++;
                }
              }
            }
          } catch (_) {}
        } else if (isCacheDir) {
          if (item === ".gitkeep") continue;
          if (maxAgeMs <= 0 || now - stat.mtimeMs > maxAgeMs) {
            freedBytes += stat.size || 0;
            if (stat.isDirectory()) {
              fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(itemPath);
            }
            deletedCount++;
          }
        } else if (isTempSessionFile(item) || isTrashFile(item)) {
          if (maxAgeMs <= 0 || now - stat.mtimeMs > maxAgeMs) {
            freedBytes += stat.size || 0;
            fs.unlinkSync(itemPath);
            deletedCount++;
          }
        }
      }
    } catch (_) {}
  }

  return { deletedCount, freedBytes };
}

/**
 * Clears ALL cache, temporary dump files, cached cookies/tokens,
 * and kills orphaned browser processes.
 */
export function clearAllCache({ logger } = {}) {
  cleanOrphanChromeProcesses(logger);
  const result = cleanTempFiles({ maxAgeMs: 0 }); // 0 = purge immediately without age limit
  if (logger) {
    const mb = (result.freedBytes / (1024 * 1024)).toFixed(2);
    logger.info(`[System Cache Clean] Total ${result.deletedCount} cache/junk files purged (${mb} MB freed).`);
  }
  return result;
}

export function autoCleanSessionCache(logger) {
  try {
    const { deletedCount, freedBytes } = cleanTempFiles();
    if (deletedCount > 0 && logger) {
      const mb = (freedBytes / (1024 * 1024)).toFixed(2);
      logger.info(
        `[System Auto Clean] Berhasil menghapus ${deletedCount} file sampah/cache sesi (${mb} MB).`
      );
    }
  } catch (err) {
    if (logger) {
      logger.error("Error pada jadwal pembersihan otomatis sesi:", err.message);
    }
  }
}

export function periodicDatabaseSnapshot(logger) {
  try {
    const dbDir = path.join(__dirname, "..", "..", "database");
    const backupDir = path.join(dbDir, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const usersFile = path.join(dbDir, "users.json");
    if (fs.existsSync(usersFile)) {
      const timestamp = new Date().toISOString().slice(0, 10);
      const snapshotPath = path.join(backupDir, `daily-snapshot-${timestamp}.json`);
      if (!fs.existsSync(snapshotPath)) {
        fs.copyFileSync(usersFile, snapshotPath);
        if (logger) {
          logger.info(`[Auto Backup] Database snapshot created: daily-snapshot-${timestamp}.json`);
        }
      }
    }
  } catch (err) {
    if (logger) logger.error("[Auto Backup Error]", err.message);
  }
}

export function cleanOrphanChromeProcesses(logger) {
  try {
    import("child_process").then(({ exec }) => {
      // Bunuh process chrome yang orphaned atau defunct jika ada
      exec("pkill -f 'chrome-linux64/chrome --type=renderer' || true", (err) => {
        if (!err && logger) {
          logger.info("[System Cleaner] Membersihkan proses browser renderer yang tidak terpakai.");
        }
      });
    }).catch(() => {});
  } catch (_) {}
}

export function startAutoCleanInterval(logger) {
  // Langsung bersihkan cache, sampah sesi, dan temporary files saat bot aktif
  try {
    clearAllCache({ logger });
    periodicDatabaseSnapshot(logger);
  } catch (_) {}

  // Interval otomatis pembersihan berkala setiap 15 menit
  const AUTO_CLEAN_INTERVAL_MS = 15 * 60 * 1000;
  const timer = setInterval(() => {
    try {
      clearAllCache({ logger });
      periodicDatabaseSnapshot(logger);
    } catch (_) {}
  }, AUTO_CLEAN_INTERVAL_MS);

  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

