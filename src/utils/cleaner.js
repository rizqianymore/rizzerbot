import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function cleanTempFiles() {
  const pathsToClean = [
    path.join(__dirname, "..", "..", "assets", "sessions", "primary_bot"),
    path.join(__dirname, "..", "..", "assets", "sessions"),
    path.join(__dirname, "..", "..", "assets", "media"),
    path.join(__dirname, "..", "..", "temp"),
    path.join(__dirname, "..", "..", "tmp"),
  ];

  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 jam untuk manual clear
  let deletedCount = 0;
  let freedBytes = 0;

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
                if (now - fileStat.mtimeMs > maxAge) {
                  freedBytes += fileStat.size || 0;
                  fs.unlinkSync(filePath);
                  deletedCount++;
                }
              }
            }
          } catch (_) {}
        } else if (isTempSessionFile(item) || isTrashFile(item)) {
          if (now - stat.mtimeMs > maxAge) {
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
  autoCleanSessionCache(logger);
  periodicDatabaseSnapshot(logger);
  cleanOrphanChromeProcesses(logger);

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    autoCleanSessionCache(logger);
    periodicDatabaseSnapshot(logger);
    cleanOrphanChromeProcesses(logger);
  }, SIX_HOURS_MS);

  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

