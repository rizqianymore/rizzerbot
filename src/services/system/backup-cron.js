import fs from "fs";
import { db } from "@/src/core/database.js";
import { createBackup, formatBytes } from "./backup.js";

function backupEnabled() {
  return String(process.env.BACKUP_TO_OWNER || "").trim() === "1";
}

function intervalMs() {
  const h = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;
  return Math.max(1, Math.min(168, h)) * 60 * 60 * 1000;
}

export async function runBackupToOwner(logger) {
  let sock = null;
  try {
    const { getPrimarySock } = await import("@/src/core/connection.js");
    sock = getPrimarySock?.() || null;
  } catch (_) {}
  if (!sock) {
    logger?.warn?.("[backup-cron] sock utama belum online, lewati.");
    return false;
  }
  let ownerJid = "";
  try {
    ownerJid = db.normalizeJid(db.getSettings()?.ownerNumber || "");
  } catch (_) {}
  if (!ownerJid) {
    logger?.warn?.("[backup-cron] ownerNumber kosong, lewati.");
    return false;
  }
  const { file, size } = await createBackup();
  try {
    await sock.sendMessage(ownerJid, {
      document: fs.readFileSync(file),
      mimetype: "application/gzip",
      fileName: String(file).split("/").pop(),
      caption:
        `Backup otomatis Rizzer Bot (${formatBytes(size)}).\n` +
        `Isi: sesi + database. Jaga file ini baik-baik, berisi kunci login WhatsApp.`,
    });
    logger?.info?.(`[backup-cron] backup terkirim ke owner (${formatBytes(size)}).`);
    return true;
  } finally {
    try {
      fs.rmSync(file, { force: true });
    } catch (_) {}
  }
}

let _started = false;

export function startBackupCron(logger) {
  if (_started) return;
  _started = true;
  if (!backupEnabled()) return;
  const run = async () => {
    try {
      await runBackupToOwner(logger);
    } catch (err) {
      logger?.warn?.(`[backup-cron] gagal: ${err?.message || err}`);
    }
  };
  setTimeout(run, 5 * 60 * 1000);
  const timer = setInterval(run, intervalMs());
  if (timer && typeof timer.unref === "function") timer.unref();
  logger?.info?.("[backup-cron] aktif: kirim backup ke owner tiap " + intervalMs() / 3600000 + " jam.");
}
