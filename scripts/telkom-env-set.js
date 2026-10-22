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
const changed = [];
for (const [key, value] of Object.entries(values)) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    const current = content.match(re)[0].split("=").slice(1).join("=");
    if (current !== value) {
      content = content.replace(re, `${key}=${value}`);
      changed.push(`${key}: ${current} -> ${value}`);
    }
  } else {
    content = content.trimEnd() + `\n${key}=${value}`;
    changed.push(`${key}=${value} (baru)`);
  }
}
fs.writeFileSync(ENV_FILE, content.trimEnd() + "\n", "utf8");

console.log(`✅ .env diperbarui (${changed.length} perubahan):`);
for (const item of changed) {
  console.log(`   - ${item.includes("PASSWORD") ? item.split(":")[0] + ": (disembunyikan)" : item}`);
}
if (!unlockerPassword || !browserPassword) {
  console.log("\nℹ️  Password Bright Data tidak diubah (kalau belum diisi, isi manual):");
  if (!unlockerPassword) console.log("   BRIGHTDATA_PROXY_PASSWORD=  (password zone web_unlocker2)");
  if (!browserPassword) console.log("   BRIGHTDATA_SCRAPING_BROWSER_PASSWORD=  (password zone scraping_browser1)");
}
console.log("\nLangkah berikutnya:");
console.log("   npm install https-proxy-agent@^7   # wajib (versi proxy agent)");
console.log("   pm2 restart rizzerbot --update-env");
console.log("   npm run telkom:net                 # verifikasi");
