import fs from "fs";
import path from "path";
import { execFile } from "node:child_process";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "temp");

// Yang ikut backup: sesi + database inti + sewa. Sengaja TIDAK ikut:
// node_modules, logs, cache, media, backups harian (hemat ukuran).
const INCLUDE_PATHS = [
  "assets/sessions",
  "database/database.json",
  "database/users.json",
  "database/rentals.json",
];

/** Buat arsip backup. Kembalikan { file, size }. */
export async function createBackup() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const file = path.join(TMP_DIR, `rizzerbot-backup-${stamp}.tar.gz`);
  const existing = INCLUDE_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)));
  if (!existing.length) throw new Error("Tidak ada data untuk dibackup");
  await new Promise((resolve, reject) => {
    execFile("tar", ["-czf", file, ...existing], { cwd: ROOT, timeout: 120000 }, (err) =>
      err ? reject(new Error(`tar gagal: ${err.message}`)) : resolve()
    );
  });
  const stat = fs.statSync(file);
  return { file, size: stat.size };
}

/** Validasi + ekstrak arsip backup ke ROOT. Kembalikan daftar entry. */
export async function restoreBackup(tarPath) {
  if (!fs.existsSync(tarPath)) throw new Error("File backup tidak ditemukan");
  const list = await new Promise((resolve, reject) => {
    execFile("tar", ["-tzf", tarPath], { timeout: 30000 }, (err, stdout) =>
      err ? reject(new Error("File bukan arsip backup yang valid")) : resolve(String(stdout || ""))
    );
  });
  const hasSessions = list.includes("assets/sessions");
  const hasDb = list.includes("database/");
  if (!hasSessions && !hasDb) throw new Error("Arsip tidak berisi data sesi/database rizzerbot");
  await new Promise((resolve, reject) => {
    execFile("tar", ["-xzf", tarPath, "-C", ROOT], { timeout: 120000 }, (err) =>
      err ? reject(new Error(`Restore gagal: ${err.message}`)) : resolve()
    );
  });
  return { entries: list.split("\n").filter(Boolean).length, hasSessions, hasDb };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
