import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function autoCleanSessionCache(logger) {
  try {
    const pathsToClean = [
      path.join(__dirname, "..", "..", "assets", "sessions", "primary_bot"),
      path.join(__dirname, "..", "..", "assets", "sessions"),
    ];

    const now = Date.now();
    const maxAge = 12 * 60 * 60 * 1000; // 12 jam
    let deletedCount = 0;

    const isTempFile = (name) => {
      // PENTING: Jangan pernah menghapus session-* atau sender-key-* karena itu adalah state enkripsi Signal aktif
      // Menghapus session-* akan menyebabkan MessageCounterError / Failed to decrypt message
      return (
        name.endsWith(".json") &&
        (name.startsWith("pre-key-") ||
          name.startsWith("app-state-sync-key-"))
      );
    };

    for (const basePath of pathsToClean) {
      if (!fs.existsSync(basePath)) continue;

      const items = fs.readdirSync(basePath);
      for (const item of items) {
        const itemPath = path.join(basePath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && item.startsWith("session_")) {
          const subFiles = fs.readdirSync(itemPath);
          for (const subFile of subFiles) {
            if (isTempFile(subFile)) {
              const filePath = path.join(itemPath, subFile);
              const fileStat = fs.statSync(filePath);
              if (now - fileStat.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
                deletedCount++;
              }
            }
          }
        } else if (isTempFile(item)) {
          if (now - stat.mtimeMs > maxAge) {
            fs.unlinkSync(itemPath);
            deletedCount++;
          }
        }
      }
    }

    if (deletedCount > 0 && logger) {
      logger.info(
        `[System Auto Clean] Berhasil menghapus ${deletedCount} file sampah/cache sesi Baileys (file > 12 jam).`
      );
    }
  } catch (err) {
    if (logger) {
      logger.error("Error pada jadwal pembersihan otomatis sesi:", err.message);
    }
  }
}

export function startAutoCleanInterval(logger) {
  autoCleanSessionCache(logger);
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 12 jam
  setInterval(() => {
    autoCleanSessionCache(logger);
  }, TWELVE_HOURS_MS);
}
