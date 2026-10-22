#!/usr/bin/env node
/**
 * Cek status jalur anti-protection (Bright Data Unlocker / Scraping Browser /
 * browser stealth) dan uji sebuah URL target.
 *
 * Pakai:
 *   node scripts/probe-unlock.js                     # status saja
 *   node scripts/probe-unlock.js https://example.com # status + uji URL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

// Alias "@/..." -> root project (dibuat index.js saat bot start; pastikan di sini juga).
const aliasPath = path.join(ROOT, "node_modules", "@");
if (!fs.existsSync(aliasPath)) {
  fs.symlinkSync(ROOT, aliasPath, fs.constants && process.platform === "win32" ? "junction" : "dir");
}

// Muat .env bila ada (supaya status_balance sama dengan saat bot jalan).
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const { getBrightDataConfig, isBrightDataEnabled } = await import(
  pathToFileURL(path.join(ROOT, "src/services/network/brightdata.js")).href
);
const { nativeProxyConfig } = await import(
  pathToFileURL(path.join(ROOT, "src/services/network/unlocker-proxy.js")).href
);
const { scrapingBrowserEndpoint, remoteBrowserAvailable } = await import(
  pathToFileURL(path.join(ROOT, "src/services/network/scraping-browser.js")).href
);
const { protectedFetchWithMeta } = await import(
  pathToFileURL(path.join(ROOT, "src/services/network/scraper/index.js")).href
);

function line(label, ok, detail) {
  const mark = ok ? "OK  " : "--  ";
  console.log(`  ${mark} ${label.padEnd(26)} ${detail}`);
}

console.log("Status jalur anti-protection:\n");

const bd = getBrightDataConfig();
line(
  "Web Unlocker (REST)",
  isBrightDataEnabled(),
  isBrightDataEnabled() ? `zone=${bd.zone} (api key terisi)` : "BRIGHTDATA_API_KEY belum diisi"
);

const proxy = nativeProxyConfig();
line(
  "Native proxy Unlocker",
  Boolean(proxy),
  proxy ? `${proxy.host}:${proxy.port} user=${proxy.username}` : "BRIGHTDATA_CUSTOMER + PASSWORD belum diisi"
);

const ws = scrapingBrowserEndpoint();
line(
  "Scraping Browser (remote)",
  remoteBrowserAvailable(),
  ws ? "endpoint WS terisi" : "BRIGHTDATA_CUSTOMER + password zone remote belum diisi"
);

let chromePath = "";
try {
  const puppeteer = (await import("puppeteer")).default;
  const resolved = puppeteer.executablePath();
  chromePath = typeof resolved === "string" ? resolved : await resolved;
} catch (_) {}
const disabled = ["1", "true", "yes"].includes(String(process.env.BROWSER_DISABLED || "").toLowerCase());
line(
  "Browser stealth (lokal)",
  !disabled && Boolean(chromePath) && fs.existsSync(chromePath),
  disabled ? "BROWSER_DISABLED=1" : chromePath || "chrome tidak ditemukan"
);

const target = process.argv[2];
if (!target) {
  console.log(
    "\nSelesai. Tambahkan URL untuk menguji rantai, contoh:\n  node scripts/probe-unlock.js https://example.com\n"
  );
  process.exit(0);
}

console.log(`\nMenguji ${target} ...\n`);
const attempts = [];
const vias = [];
try {
  const result = await protectedFetchWithMeta(target, {
    responseType: "text",
    timeout: 30000,
    onAttempt: (entry) => attempts.push(entry),
    onVia: (via) => vias.push(via),
  });
  console.log(`  Berhasil lewat: ${vias.join(", ") || "-"}`);
  console.log(`  Percobaan    : ${attempts.join(" | ") || "-"}`);
  const body = String(result.data || "");
  console.log(`  Panjang body : ${body.length} karakter`);
  console.log(`  Cuplikan     : ${body.slice(0, 120).replace(/\s+/g, " ")}`);
} catch (err) {
  console.log(`  GAGAL: ${err.message}`);
  console.log(`  Percobaan    : ${(err.attempts || attempts).join(" | ") || "-"}`);
  process.exitCode = 1;
}
