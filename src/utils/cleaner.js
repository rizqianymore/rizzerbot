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
    path.join(__dirname, "..", "..", "assets", "media"),
    path.join(__dirname, "..", "..", "assets", "cache"),
    path.join(__dirname, "..", "..", "temp"),
    path.join(__dirname, "..", "..", "tmp"),
  ];

  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  const rootClean = cleanRootJunkFiles();
  deletedCount += rootClean.count;
  freedBytes += rootClean.bytes;

  const isTempSessionFile = (name) => {
    return false;
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

export function clearAllCache({ logger } = {}) {
  cleanOrphanChromeProcesses(logger);
  const result = cleanTempFiles();
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

    const timestamp = new Date().toISOString().slice(0, 10);
    const snap = (src, name) => {
      if (!fs.existsSync(src)) return;
      const snapshotPath = path.join(backupDir, `${name}-${timestamp}.json`);
      if (!fs.existsSync(snapshotPath)) {
        fs.copyFileSync(src, snapshotPath);
        if (logger) {
          logger.info(`[Auto Backup] Database snapshot created: ${name}-${timestamp}.json`);
        }
      }
    };

    snap(path.join(dbDir, "users.json"), "daily-snapshot");

    try {
      const subDir = path.join(dbDir, "subbots");
      if (fs.existsSync(subDir)) {
        for (const entry of fs.readdirSync(subDir)) {
          const digits = String(entry).replace(/[^0-9]/g, "");
          if (!digits) continue;
          snap(path.join(subDir, entry, "users.json"), `sub-${digits}-snapshot`);
        }
      }
    } catch (_) {}
  } catch (err) {
    if (logger) logger.error("[Auto Backup Error]", err.message);
  }
}

export function cleanOrphanChromeProcesses(logger) {
  try {
    import("child_process").then(({ exec }) => {

      exec("pkill -f 'chrome-linux64/chrome --type=renderer' || true", (err) => {
        if (!err && logger) {
          logger.info("[System Cleaner] Membersihkan proses browser renderer yang tidak terpakai.");
        }
      });
    }).catch(() => {});
  } catch (_) {}
}

export function startAutoCleanInterval(logger) {

  try {
    clearAllCache({ logger });
    periodicDatabaseSnapshot(logger);
  } catch (_) {}

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
