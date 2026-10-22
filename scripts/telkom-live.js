#!/usr/bin/env node
/**
 * Uji live modul Telkom Schools dari terminal.
 *
 *   node scripts/telkom-live.js 539241099              -> cek status (read-only)
 *   node scripts/telkom-live.js 539241099 --submit     -> + kirim absen
 *   node scripts/telkom-live.js 539241099 --pw <password>
 *   node scripts/telkom-live.js 539241099 --qr '<json payload QR>'
 *
 * Memakai .env (vault / pola password) kalau password tidak diberikan.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

// Muat .env (sama seperti index.js).
try {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch (_) {}

const args = process.argv.slice(2);
const nis = (args.find((a) => /^\d{5,15}$/.test(a)) || "").trim();
const wantSubmit = args.includes("--submit");
const pwIndex = args.indexOf("--pw");
const password = pwIndex >= 0 ? String(args[pwIndex + 1] || "") : "";
const qrIndex = args.indexOf("--qr");
let qrPayload = null;
if (qrIndex >= 0) {
  try {
    const raw = String(args[qrIndex + 1] || "");
    const parsed = JSON.parse(raw);
    qrPayload = Array.isArray(parsed) ? JSON.parse(parsed[0]) : parsed;
  } catch (_) {}
}

if (!nis) {
  console.log("Pakai: node scripts/telkom-live.js <nis> [--submit] [--pw <password>] [--qr '<json>']");
  process.exit(1);
}

const { runAttendanceFlow } = await import("../src/services/telkom/service.js");
const { schoolInfo } = await import("../src/services/telkom/school.js");

console.log(`NIS      : ${nis}`);
console.log(`Mode     : ${wantSubmit ? "cek + submit absen" : "cek status saja"}`);
console.log(`Password : ${password ? "dari argumen" : "dari vault/pola .env"}`);
console.log(`Sekolah  : ${schoolInfo().name}`);
console.log("");

const t0 = Date.now();
const result = await runAttendanceFlow({
  nis,
  password,
  actorJid: "628999888777@s.whatsapp.net",
  allowSubmit: wantSubmit,
  qrPayload,
  logger: {
    info: (msg, extra) => console.log(`  [info] ${msg}`, extra ? JSON.stringify(extra) : ""),
    warn: (msg, extra) => console.log(`  [warn] ${msg}`, extra ? JSON.stringify(extra) : ""),
  },
});

console.log(`\nSelesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} detik`);
console.log(`ok: ${result.ok}${result.code ? ` (${result.code})` : ""}`);
console.log("\n" + (result.summary || result.message || "-"));
if (result.submit) console.log("\nsubmit:", JSON.stringify(result.submit));
process.exit(result.ok ? 0 : 1);
