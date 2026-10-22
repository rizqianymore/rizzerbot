#!/usr/bin/env node
/**
 * Tulis konfigurasi Telkom Schools + Bright Data ke .env (idempotent).
 *
 *   node scripts/telkom-env-set.js                 -> pakai nilai default
 *   node scripts/telkom-env-set.js --unlocker <pw> --browser <pw> [customer]
 *
 * Nilai yang sudah ada di .env TIDAK ditimpa kecuali yang diberikan lewat argumen.
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_FILE = path.join(ROOT, ".env");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || "").trim() : "";
};

const customer = arg("--customer") || "hl_66a04297";
const unlockerPassword = arg("--unlocker");
const browserPassword = arg("--browser");

// Nilai default (bisa dioverride lewat argumen).
const values = {
  // --- Telkom Schools ---
  TELKOM_PASSWORD_PATTERN: "dummy@{nis}",
  TELKOM_SCHOOL_NAME: "SMK Telkom Jakarta",
  TELKOM_SCHOOL_LAT: "-6.1544783",
  TELKOM_SCHOOL_LNG: "106.7507579",
  TELKOM_SCHOOL_RADIUS_M: "150",
  TELKOM_SCHOOL_URL:
    "https://www.google.com/maps/place/SMK+Telkom+Jakarta/@-6.1544288,106.7501684,19.03z/data=!4m14!1m7!3m6!1s0x2e69f7c113c644b5:0xa3a809c8c4627262!2sSMK+Telkom+Jakarta!8m2!3d-6.1544783!4d106.7507579!16s%2Fg%2F122dry26",
  TELKOM_USE_SCHOOL_LOCATION: "1",
  TELKOM_AUTO_QR: "1",
  TELKOM_DAILY_LIMIT: "3",
  TELKOM_WINDOW_DATANG: "05:30-08:00",
  TELKOM_WINDOW_PULANG: "14:30-16:30",
  // --- Bright Data: zone web_unlocker2 (native proxy 44445) ---
  BRIGHTDATA_CUSTOMER: customer,
  BRIGHTDATA_ZONE: "web_unlocker2",
  BRIGHTDATA_PROXY_ZONE: "web_unlocker2",
  BRIGHTDATA_PROXY_HOST: "brd.superproxy.io",
  BRIGHTDATA_PROXY_PORT: "44445",
  ...(unlockerPassword ? { BRIGHTDATA_PROXY_PASSWORD: unlockerPassword } : {}),
  // --- Bright Data: zone scraping_browser1 (remote browser 9222) ---
  BRIGHTDATA_SCRAPING_BROWSER_ZONE: "scraping_browser1",
  BRIGHTDATA_SCRAPING_BROWSER_HOST: "brd.superproxy.io",
  BRIGHTDATA_SCRAPING_BROWSER_PORT: "9222",
  ...(browserPassword ? { BRIGHTDATA_SCRAPING_BROWSER_PASSWORD: browserPassword } : {}),
  // --- Browser stealth: hemat RAM ---
  BROWSER_IDLE_MS: "30000",
  BROWSER_MAX_OLD_SPACE_MB: "192",
};

if (!fs.existsSync(ENV_FILE)) {
  console.log("❌ .env belum ada.");
  process.exit(1);
}

let content = fs.readFileSync(ENV_FILE, "utf8");

// 1) Buang SEMUA kemunculan key yang dikelola (duplikat -> ambigu, yg terakhir menang).
const managed = Object.keys(values);
const removed = [];
content = content
  .split(/\r?\n/)
  .filter((line) => {
    const key = line.split("=")[0]?.trim();
    if (managed.includes(key)) {
      removed.push(key);
      return false;
    }
    return true;
  })
  .join("\n");

// 2) Tulis blok bersih (satu kemunculan per key).
const block = [
  "",
  "# --- Telkom Schools / DigitS (presensi siswa, auto-absen) ---",
  "# Password: vault per siswa, atau pola password sekolah.",
  ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
  "",
  "# --- Bright Data: 2 zone, password masing-masing ---",
  "# zone web_unlocker2   -> native proxy (port 44445)",
  "# zone scraping_browser1 -> remote browser (WS 9222)",
  "",
].join("\n");

fs.writeFileSync(ENV_FILE, content.trimEnd() + "\n" + block, "utf8");

const dupes = removed.filter((key, i) => removed.indexOf(key) !== i);
console.log(`✅ .env ditata ulang (${removed.length} baris key ditulis ulang, 1 blok bersih).`);
if (dupes.length) {
  console.log(`   duplikat yang dibuang: ${[...new Set(dupes)].join(", ")}`);
}
console.log("   Password tidak ditampilkan di log.");
if (!unlockerPassword || !browserPassword) {
  console.log("\nℹ️  Password Bright Data tidak diubah (kalau belum diisi, isi manual):");
  if (!unlockerPassword) console.log("   BRIGHTDATA_PROXY_PASSWORD=  (password zone web_unlocker2)");
  if (!browserPassword) console.log("   BRIGHTDATA_SCRAPING_BROWSER_PASSWORD=  (password zone scraping_browser1)");
}
console.log("\nLangkah berikutnya:");
console.log("   npm install https-proxy-agent@^7   # wajib (versi proxy agent)");
console.log("   pm2 restart rizzerbot --update-env");
console.log("   npm run telkom:net                 # verifikasi");
