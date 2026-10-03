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
  // Tolak symlink / path traversal: tarPath harus file biasa di dalam temp/.
  try {
    const stat = fs.lstatSync(tarPath);
    if (!stat.isFile()) throw new Error("Path backup tidak valid");
  } catch (err) {
    throw new Error(`Path backup tidak valid: ${err.message}`);
  }
  const list = await new Promise((resolve, reject) => {
    execFile("tar", ["-tzf", tarPath], { timeout: 30000 }, (err, stdout) =>
      err ? reject(new Error("File bukan arsip backup yang valid")) : resolve(String(stdout || ""))
    );
  });
  const entries = list.split("\n").map((s) => s.trim()).filter(Boolean);
  // ALLOWLIST ketat: hanya sesi + database inti + sewa. Tolak absolute path,
  // traversal (..), symlink entry, dan file di luar daftar (mis. plugins/,
  // package.json, .env) agar arsip jahat tidak bisa overwrite kode / tanam
  // owner via database/users.json palsu di path lain.
  const ALLOWED = [
    /^assets\/sessions\//,
    /^assets\/sessions$/,
    /^database\/database\.json$/,
    /^database\/users\.json$/,
    /^database\/rentals\.json$/,
  ];
  // Sub-bot DB diizinkan: database/subbots/<digits>/(database|users).json
  const ALLOWED_SUB = /^database\/subbots\/[0-9]{8,16}\/(database|users)\.json$/;
  for (const entry of entries) {
    const e = entry.replace(/^\.\//, "");
    if (!e || e.startsWith("/") || e.includes("..") || path.isAbsolute(e)) {
      throw new Error(`Arsip ditolak: entry berbahaya (${e.slice(0, 80)})`);
    }
    const ok = ALLOWED.some((re) => re.test(e)) || ALLOWED_SUB.test(e);
    if (!ok) {
      throw new Error(`Arsip ditolak: entry di luar allowlist (${e.slice(0, 80)})`);
    }
  }
  const hasSessions = entries.some((e) => e.replace(/^\.\//, "").startsWith("assets/sessions"));
  const hasDb = entries.some((e) => e.replace(/^\.\//, "").startsWith("database/"));
  if (!hasSessions && !hasDb) throw new Error("Arsip tidak berisi data sesi/database rizzerbot");
  await new Promise((resolve, reject) => {
    // --no-same-owner agar tidak ada privilege escalation via ownership tar.
    execFile("tar", ["-xzf", tarPath, "-C", ROOT, "--no-same-owner"], { timeout: 120000 }, (err) =>
      err ? reject(new Error(`Restore gagal: ${err.message}`)) : resolve()
    );
  });
  return { entries: entries.length, hasSessions, hasDb };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
