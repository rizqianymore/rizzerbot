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

// Tes kredensial native proxy Bright Data (tanpa kuota, cuma handshake).
try {
  const { nativeProxyConfig, proxyRequest } = await import("../src/services/telkom/proxy.js");
  const cfg = nativeProxyConfig();
  if (!cfg) {
    console.log("\nnative proxy  : BELUM dikonfigurasi (BRIGHTDATA_CUSTOMER + PROXY_PASSWORD)");
  } else {
    const res = await proxyRequest("https://gw-digits.telkomschools.sch.id/api/read/x", {
      method: "GET",
      headers: { "User-Agent": "curl/8.5.0" },
      timeoutMs: 20000,
    });
    console.log(`\nnative proxy  : OK (auth ${cfg.username}@${cfg.host}:${cfg.port}) -> status ${res.status}`);
  }
} catch (err) {
  console.log(`\nnative proxy  : GAGAL -> ${String(err?.message || err).slice(0, 160)}`);
  console.log("  -> cek BRIGHTDATA_CUSTOMER / BRIGHTDATA_ZONE / BRIGHTDATA_PROXY_PASSWORD");
}

// Tes apakah native proxy meneruskan header Authorization (kritis buat API).
try {
  const { proxyRequest } = await import("../src/services/telkom/proxy.js");
  const form = new FormData();
  form.append("username", "539241249");
  form.append("password", "dummy@539241249");
  const login = await proxyRequest("https://gateway.ypt.or.id/telkomschool/student/issueauth/web", {
    method: "POST",
    headers: { "User-Agent": "curl/8.5.0", Accept: "application/json" },
    body: form,
    isForm: true,
    timeoutMs: 25000,
  });
  const token = login?.data?.token;
  console.log(`\nproxy login    : status ${login.status} | token: ${token ? "didapat" : "TIDAK didapat"}`);
  if (token) {
    const api = await proxyRequest("https://gw-digits.telkomschools.sch.id/api/read/7b566720a8dd41916b2d3f565f57f42b", {
      method: "GET",
      headers: { "User-Agent": "curl/8.5.0", Accept: "application/json", Authorization: `Bearer ${token}` },
      timeoutMs: 25000,
    });
    const ok = api.status !== 401 && api.status !== 403;
    console.log(
      `proxy API+token: status ${api.status} -> ${ok ? "Authorization DITERUSKAN ✓" : "Authorization TIDAK diteruskan (proxy stripping) ✗"}`
    );
  }
} catch (err) {
  console.log(`\nproxy tes      : GAGAL -> ${String(err?.message || err).slice(0, 150)}`);
}

// Cek browser lokal (fallback kalau remote browser tidak bisa dipakai).
try {
  const puppeteer = (await import("puppeteer")).default;
  const resolved = puppeteer.executablePath();
  const chromePath = typeof resolved === "string" ? resolved : await resolved;
  const fs = await import("fs");
  const ok = Boolean(chromePath) && fs.existsSync(chromePath);
  console.log(
    `\nbrowser lokal : ${ok ? "siap (fallback API ber-token)" : "TIDAK ADA - install: npx puppeteer browsers install chrome"}`
  );
} catch (_err) {
  console.log("\nbrowser lokal : modul puppeteer tidak tersedia");
}

// Tes handshake WS BrightData (menampilkan status asli handshake).
try {
  const ws = String(process.env.BRIGHTDATA_SCRAPING_BROWSER_WS || "").trim();
  if (!ws) {
    console.log("\nWS handshake  : BRIGHTDATA_SCRAPING_BROWSER_WS belum diisi");
  } else {
    const url = new URL(ws.replace(/^wss:/, "https:"));
    const auth = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    const https = await import("https");
    const status = await new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        try {
          req.destroy();
        } catch (_) {}
        resolve(value);
      };
      const req = https.request(
        {
          host: url.hostname,
          port: url.port || 9222,
          path: "/",
          method: "GET",
          headers: {
            Authorization: `Basic ${Buffer.from(auth).toString("base64")}`,
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Version": "13",
            "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
          },
          timeout: 12000,
        },
        (res) => {
          finish(res.statusCode);
          res.resume();
        }
      );
      req.on("error", (err) => finish(`error: ${String(err.message).slice(0, 60)}`));
      req.on("timeout", () => finish("timeout (tidak ada handshake)"));
      req.on("close", () => finish("ditutup tanpa handshake"));
      // Guard keras: WS server bisa menahan socket tanpa membalas.
      setTimeout(() => finish("timeout 10d (tidak ada handshake)"), 10000).unref?.();
      req.end();
    });
    const note =
      status === 407 || status === 401
        ? "-> kredensial zone scraping_browser1 salah ATAU IP lo tidak di-allowlist zone itu"
        : status === 426 || status === 400
          ? "-> kredensial OK (server cuma nolak request biasa, bukan WebSocket)"
          : "";
    console.log(`\nWS handshake  : status ${status} ${note}`);
  }
} catch (err) {
  console.log(`\nWS handshake  : GAGAL -> ${String(err?.message || err).slice(0, 120)}`);
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
