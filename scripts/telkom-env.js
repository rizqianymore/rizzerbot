#!/usr/bin/env node
/**
 * Helper konfigurasi Telkom Schools.
 *
 *   node scripts/telkom-env.js          -> cek status config (tanpa buka secret)
 *   node scripts/telkom-env.js --apply  -> tambahkan blok config telkom ke .env
 *                                          (idempotent: nilai yang sudah ada TIDAK ditimpa)
 *
 * Aman: password tidak pernah ditampilkan; hanya "terisi/kosong".
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_FILE = path.join(ROOT, ".env");

// key -> { nilai, secret? }
const DEFAULTS = [
  ["TELKOM_PASSWORD_PATTERN", "dummy@{nis}", true],
  ["TELKOM_SCHOOL_NAME", "SMK Telkom Jakarta", false],
  ["TELKOM_SCHOOL_LAT", "-6.1544783", false],
  ["TELKOM_SCHOOL_LNG", "106.7507579", false],
  ["TELKOM_SCHOOL_RADIUS_M", "150", false],
  [
    "TELKOM_SCHOOL_URL",
    "https://www.google.com/maps/place/SMK+Telkom+Jakarta/@-6.1544288,106.7501684,19.03z/data=!4m14!1m7!3m6!1s0x2e69f7c113c644b5:0xa3a809c8c4627262!2sSMK+Telkom+Jakarta!8m2!3d-6.1544783!4d106.7507579!16s%2Fg%2F122dry26",
    false,
  ],
  ["TELKOM_USE_SCHOOL_LOCATION", "1", false],
  ["TELKOM_DAILY_LIMIT", "3", false],
  ["TELKOM_WINDOW_DATANG", "05:30-08:00", false],
  ["TELKOM_WINDOW_PULANG", "14:30-16:30", false],
  // --- bypass Cloudflare ---
  ["BRIGHTDATA_SCRAPING_BROWSER_ZONE", "scraping_browser1", false],
  ["BRIGHTDATA_PROXY_ZONE", "web_unlocker2", false],
  ["BRIGHTDATA_SCRAPING_BROWSER_CLOSE", "1", false],
  ["TELKOM_VIA_BRIGHTDATA_BROWSER", "1", false],
  // --- browser stealth: hemat RAM ---
  ["TELKOM_AUTO_QR", "1", false],
  ["BROWSER_IDLE_MS", "30000", false],
  ["BROWSER_MAX_OLD_SPACE_MB", "192", false],
];

// Key yang wajib diisi manual (nilainya gw tidak bisa tebak).
// Policy auto-absen: sering berubah default -> bisa disinkronkan (--sync).
const POLICY = ["TELKOM_USE_SCHOOL_LOCATION", "TELKOM_AUTO_QR"];

const MANUAL = [
  ["BRIGHTDATA_CUSTOMER", "contoh: hl_66a04297"],
  ["BRIGHTDATA_PROXY_PASSWORD", "password proxy dari dashboard BrightData"],
];

const SECRET_LIKE = /PASSWORD|PW_|TOKEN|KEY|SECRET|COOKIE/i;

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return { text: "", exists: false };
  return { text: fs.readFileSync(ENV_FILE, "utf8"), exists: true };
}

function parseKeys(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    map.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
  }
  return map;
}

function status() {
  const { text, exists } = readEnv();
  const keys = parseKeys(text);
  console.log(`File .env: ${exists ? ENV_FILE : "BELUM ADA (" + ENV_FILE + ")"}`);
  console.log("");
  for (const [key, defValue, secret] of DEFAULTS) {
    const value = keys.get(key);
    const state = value === undefined ? "kosong" : value === "" ? "kosong" : "terisi";
    let shown = "";
    if (value) {
      if (secret || SECRET_LIKE.test(key)) shown = "(disembunyikan)";
      else shown = value;
    }
    const def = key === "TELKOM_PASSWORD_PATTERN" ? "(opsional)" : defValue;
    console.log(
      `  ${state.padEnd(7)} ${key.padEnd(26)} ${shown || "-"}`.padEnd(60) +
        (value === undefined ? `default: ${def}` : "")
    );
  }
  console.log("");
  console.log("Catatan:");
  console.log("  - .env dibaca saat bot START -> selesai edit, restart bot.");
  console.log("  - env yang sudah ada di shell/pm2 TIDAK ditimpa .env (lihat index.js).");
  console.log("  - TELKOM_USE_SCHOOL_LOCATION=1 mematikan pengecekan radius server.");

  // Status Bright Data (bridge bypass Cloudflare)
  const bdKey = keys.get("BRIGHTDATA_API_KEY");
  const bdZone = keys.get("BRIGHTDATA_ZONE");
  console.log("");
  console.log("Bridge Bright Data (bypass Cloudflare):");
  console.log(`  BRIGHTDATA_API_KEY : ${bdKey ? "terisi" : "KOSONG (bridge nonaktif)"}`);
  console.log(`  BRIGHTDATA_ZONE    : ${bdZone || "web_unlocker2 (default)"}`);
  console.log(`  TELKOM_VIA_BRIGHTDATA: ${keys.get("TELKOM_VIA_BRIGHTDATA") || "1 (default)"}`);
  if (!bdKey) {
    console.log("  -> bypass Cloudflare telkom pakai browser stealth (puppeteer).");
  }

  console.log("");
  console.log("Scraping Browser (remote, jalur terbaik):");
  const ws = keys.get("BRIGHTDATA_SCRAPING_BROWSER_WS");
  const customer = keys.get("BRIGHTDATA_CUSTOMER");
  const proxyPass = keys.get("BRIGHTDATA_PROXY_PASSWORD") || keys.get("BRIGHTDATA_PASSWORD");
  const sbZone = keys.get("BRIGHTDATA_SCRAPING_BROWSER_ZONE");
  const sbPassword = keys.get("BRIGHTDATA_SCRAPING_BROWSER_PASSWORD");
  const proxyZone = keys.get("BRIGHTDATA_PROXY_ZONE") || keys.get("BRIGHTDATA_ZONE");
  console.log(`  BRIGHTDATA_SCRAPING_BROWSER_WS: ${ws ? "terisi" : "kosong"}`);
  console.log(`  password zone scraping_browser1: ${sbPassword ? "terisi" : "KOSONG"}`);
  console.log(`  password zone ${proxyZone || "web_unlocker2"}: ${proxyPass ? "terisi" : "KOSONG"}`);
  if (!ws) {
    console.log(`  BRIGHTDATA_CUSTOMER            : ${customer ? "terisi" : "kosong"}`);
    console.log(`  BRIGHTDATA_PROXY_PASSWORD      : ${proxyPass ? "terisi" : "kosong"}`);
    console.log(`  BRIGHTDATA_SCRAPING_BROWSER_ZONE: ${sbZone || "kosong (mis. scraping_browser1)"}`);
  }
  console.log(`  TELKOM_VIA_BRIGHTDATA_BROWSER  : ${keys.get("TELKOM_VIA_BRIGHTDATA_BROWSER") || "1 (default)"}`);
  if (ws || (customer && proxyPass && sbZone)) {
    console.log("  -> siap: challenge diatasi lewat remote browser (IP bersih).");
  } else {
    console.log("  -> scraping browser nonaktif; pakai Web Unlocker / browser stealth.");
  }
}

function apply() {
  const { text, exists } = readEnv();
  const keys = parseKeys(text);
  const missing = DEFAULTS.filter(([key]) => keys.get(key) === undefined);
  // Placeholder yang sudah ada (diformat "# KEY=  <- hint") dianggap sudah diisi.
  const missingManual = MANUAL.filter(([key]) => keys.get(key) === undefined && !text.includes(`# ${key}=`));

  if (!exists) {
    console.log("❌ .env belum ada. Buat dulu (minimal berisi konfigurasi bot lain).");
    process.exit(1);
  }

  // --sync: samakan policy auto-absen dengan default terbaru.
  const sync = process.argv.includes("--sync");
  const changed = [];
  if (sync) {
    for (const [key, value] of DEFAULTS.filter(([key]) => POLICY.includes(key))) {
      const current = keys.get(key);
      if (current !== undefined && current !== value) {
        changed.push({ key, from: current, to: value });
      }
    }
  }

  if (!missing.length && !missingManual.length && !changed.length) {
    console.log("✅ Semua key sudah ada di .env — tidak ada yang diubah.");
    return;
  }

  let content = text;
  if (missing.length || missingManual.length) {
    content += [
      "",
      "# --- Telkom Schools / DigitS (presensi siswa, auto-scan QR) ---",
      "# Password: pakai vault per siswa, atau pola password sekolah (opsional).",
      ...missing.map(([key, value]) => `${key}=${value}`),
      "",
      "# --- Bright Data Scraping Browser (remote browser, bypass Cloudflare) ---",
      "# Isi salah satu: BRIGHTDATA_SCRAPING_BROWSER_WS (1 baris) ATAU 3 baris di bawah.",
      ...missingManual.map(([key, hint]) => `# ${key}=  <- ${hint}`),
      "",
    ].join("\n");
  }
  for (const item of changed) {
    content = content.replace(new RegExp(`^${item.key}=.*$`, "m"), `${item.key}=${item.to}`);
  }
  fs.writeFileSync(ENV_FILE, content, "utf8");

  if (missing.length || missingManual.length) {
    console.log(`✅ ${missing.length + missingManual.length} key ditambahkan ke .env:`);
    for (const [key] of missing) console.log(`   - ${key}`);
    for (const [key] of missingManual) console.log(`   - ${key}  (ISI MANUAL)`);
  }
  if (changed.length) {
    console.log("🔄 Policy auto-absen disinkronkan:");
    for (const item of changed) console.log(`   - ${item.key}: ${item.from} -> ${item.to}`);
  }
  console.log("");
  if (missingManual.length) {
    console.log("⚠️  Yang perlu lo isi manual:");
    for (const [key, hint] of missingManual) console.log(`   ${key}=  (${hint})`);
    console.log("");
  }
  console.log("Langkah berikutnya: restart bot (pm2 restart rizzerbot).");
}

const arg = process.argv[2];
if (arg === "--apply") apply();
else status();
