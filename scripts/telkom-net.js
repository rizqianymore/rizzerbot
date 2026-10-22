#!/usr/bin/env node
/**
 * Diagnosa konektivitas Telkom Schools + Bright Data.
 *
 *   node scripts/telkom-net.js           -> cek host & API (murah)
 *   node scripts/telkom-net.js --browser -> plus tes remote browser (pakai kuota)
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

// Muat .env manual (sama seperti index.js) supaya env terbaca.
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

const HOSTS = [
  ["gateway login", "https://gateway.ypt.or.id/telkomschool/student/issueauth/web", "POST"],
  ["API presensi", "https://gw-digits.telkomschools.sch.id/api/presensi-read/x/1", "GET"],
  ["App presensi", "https://presensi.telkomschools.sch.id/", "GET"],
  ["Portal digits", "https://digits.telkomschools.sch.id/", "GET"],
  ["BrightData API", "https://api.brightdata.com/request", "POST"],
  ["BrightData WS", "https://brd.superproxy.io:9222", "GET"],
];

async function probe(label, url, method) {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/155.0.0.0" },
    });
    const ms = Date.now() - t0;
    const body = await res.text().catch(() => "");
    const note = res.status === 401 || res.status === 403 ? "(401/403 = replied, network OK)" : "";
    console.log(`  OK    ${label.padEnd(16)} ${String(res.status).padEnd(4)} ${ms}ms ${note}`);
    // Potongan body supaya kelihatan kalau dibalas halaman Cloudflare/challenge.
    const snippet = body.replace(/\s+/g, " ").slice(0, 110);
    if (snippet && !snippet.startsWith("{")) {
      console.log(`        body: ${snippet}`);
    } else if (snippet) {
      console.log(`        body: ${snippet}`);
    }
    return true;
  } catch (err) {
    const ms = Date.now() - t0;
    const reason = String(err?.message || err).slice(0, 60);
    console.log(`  FAIL  ${label.padEnd(16)} ${ms}ms ${reason}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

console.log("Cek konektivitas (timeout 12 detik per host):\n");
for (const [label, url, method] of HOSTS) {
  await probe(label, url, method);
}

console.log("\nKonfigurasi Bright Data:");
console.log(`  BRIGHTDATA_API_KEY        : ${process.env.BRIGHTDATA_API_KEY ? "terisi" : "KOSONG"}`);
console.log(`  BRIGHTDATA_ZONE           : ${process.env.BRIGHTDATA_ZONE || "web_unlocker2 (default)"}`);
console.log(`  BRIGHTDATA_SCRAPING_BROWSER_WS: ${process.env.BRIGHTDATA_SCRAPING_BROWSER_WS ? "terisi" : "kosong"}`);
console.log(`  BRIGHTDATA_CUSTOMER       : ${process.env.BRIGHTDATA_CUSTOMER ? "terisi" : "kosong"}`);
console.log(`  BRIGHTDATA_PROXY_PASSWORD : ${process.env.BRIGHTDATA_PROXY_PASSWORD ? "terisi" : "kosong"}`);

// IP publik server ini (penting: IP harus di-allowlist zone Bright Data).
try {
  const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
  const info = await res.json();
  console.log(`\nIP publik server ini       : ${info.ip}`);
  console.log("  -> pastikan IP ini TIDAK ada di 'Denylisted IPs' zone lo.");
} catch (_) {
  console.log("\nIP publik: tidak bisa dicek (cek manual: curl ifconfig.me)");
}

if (process.argv.includes("--browser")) {
  console.log("\nTes remote browser (pakai kuota BrightData)...");
  const { remoteSolveChallenge } = await import("../src/services/telkom/remote-browser.js");
  const t0 = Date.now();
  try {
    const res = await remoteSolveChallenge("https://presensi.telkomschools.sch.id/");
    console.log(
      `  remote browser OK: cleared=${res.cleared} cookies=${res.cookies.length} len=${res.content.length} (${Date.now() - t0}ms)`
    );
  } catch (err) {
    console.log(`  remote browser GAGAL: ${String(err?.message || err).slice(0, 160)}`);
  }
} else {
  console.log("\n(untuk tes remote browser: node scripts/telkom-net.js --browser)");
}
