/**
 * Rantai anti-protection (scraper chain).
 *
 * Setiap strategi mengembalikan `{ data, status, headers }`. Orkestrator
 * (`scraper/index.js`) memeriksa apakah hasilnya masih terproteksi; bila iya,
 * request dinaikkan ke strategi berikutnya yang lebih mahal.
 *
 * Urutan default (murah -> mahal):
 *   direct -> unlocker (REST) -> proxy (native Web Unlocker) -> browser (stealth lokal)
 *   -> scraping-browser (remote Bright Data)
 */

import axios from "axios";
import http from "http";
import https from "https";
import { brightDataRequest, isBrightDataEnabled } from "../brightdata.js";
import { nativeProxyConfig, proxyRequest } from "../unlocker-proxy.js";
import { remoteBrowserAvailable, remoteFetchBuffer, remoteInPageFetch } from "../scraping-browser.js";
import { stealthBrowser } from "@/src/utils/request/browser.js";
import { cookieJar } from "@/src/utils/request/cookies.js";

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20, keepAliveMsecs: 30000, timeout: 15000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20, keepAliveMsecs: 30000, timeout: 15000 });

function browserDisabled() {
  return ["1", "true", "yes"].includes(String(process.env.BROWSER_DISABLED || "").toLowerCase());
}

/** Samakan bentuk data sesuai responseType. */
function normalize(data, responseType) {
  if (responseType === "buffer") return Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (responseType === "text" && data !== null && typeof data === "object") return JSON.stringify(data);
  return data;
}

/** Susun URL lengkap (query string ikut digabung) untuk strategist non-axios. */
export function buildFullUrl(url, params) {
  let full = String(url);
  if (params && typeof params === "object" && Object.keys(params).length > 0) {
    try {
      const u = new URL(full);
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
      full = u.toString();
    } catch (_) {}
  }
  return full;
}

/* ------------------------------------------------------------------ *
 * 1. Direct — request biasa dengan header scraper + cookie jar.
 * ------------------------------------------------------------------ */
async function runDirect(ctx) {
  const res = await axios({
    url: ctx.url,
    method: ctx.method,
    headers: ctx.headers,
    params: ctx.params,
    data: ctx.data,
    timeout: ctx.timeout,
    responseType: ctx.responseType === "buffer" ? "arraybuffer" : ctx.responseType,
    maxContentLength: ctx.maxBytes,
    validateStatus: () => true,
    httpAgent,
    httpsAgent,
  });

  if (res.headers?.["set-cookie"]) {
    cookieJar.addCookiesFromHeader(ctx.url, res.headers["set-cookie"]);
  }

  return { data: normalize(res.data, ctx.responseType), status: res.status, headers: res.headers || {} };
}

/* ------------------------------------------------------------------ *
 * 2. Web Unlocker REST — Bright Data solving challenge via API.
 * ------------------------------------------------------------------ */
async function runUnlocker(ctx) {
  const data = await brightDataRequest(ctx.fullUrl, {
    format: ctx.responseType === "json" ? "json" : "raw",
    binary: ctx.responseType === "buffer",
    method: ctx.method,
    headers: ctx.headers,
    data: ctx.data,
    timeout: ctx.timeout,
    country: ctx.country,
    state: ctx.state,
    city: ctx.city,
  });

  return { data: normalize(data, ctx.responseType), status: 200, headers: {} };
}

/* ------------------------------------------------------------------ *
 * 3. Native proxy — Bright Data Web Unlocker via brd.superproxy.io:44445.
 * ------------------------------------------------------------------ */
async function runProxy(ctx) {
  const res = await proxyRequest(ctx.fullUrl, {
    method: ctx.method,
    headers: ctx.headers,
    body: ctx.data,
    timeoutMs: ctx.timeout,
    raw: ctx.responseType === "buffer",
  });

  if (res.status >= 400) {
    throw new Error(`Bright Data proxy HTTP ${res.status}`);
  }
  return { data: normalize(res.data, ctx.responseType), status: res.status, headers: res.headers || {} };
}

/* ------------------------------------------------------------------ *
 * 4. Browser stealth lokal (puppeteer headless di mesin sendiri).
 * ------------------------------------------------------------------ */
async function runBrowser(ctx) {
  if (ctx.responseType === "json") {
    // Ambil data lewat fetch di dalam halaman (cookie & origin ikut terpakai).
    const data = await stealthBrowser.inPageFetch(ctx.url, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.data,
    });
    return { data: normalize(data, ctx.responseType), status: 200, headers: {} };
  }

  if (ctx.responseType === "text") {
    const solved = await stealthBrowser.solveChallenge(ctx.url, {
      timeoutMs: ctx.timeout,
      preferredDevice: ctx.preferredDevice,
    });
    if (!solved.cleared) {
      throw new Error("Browser stealth gagal melewati challenge.");
    }
    return { data: solved.content || "", status: 200, headers: {} };
  }

  // Buffer: selesaikan challenge dulu, lalu unduh ulang pakai cookie clearance.
  const solved = await stealthBrowser.solveChallenge(ctx.url, {
    timeoutMs: ctx.timeout,
    preferredDevice: ctx.preferredDevice,
  });
  if (!solved.cleared) {
    throw new Error("Browser stealth gagal melewati challenge.");
  }

  const cookies = cookieJar.getCookieString(ctx.url);
  const res = await axios({
    url: ctx.url,
    method: ctx.method,
    headers: { ...ctx.headers, ...(cookies ? { Cookie: cookies } : {}) },
    params: ctx.params,
    data: ctx.data,
    timeout: ctx.timeout,
    responseType: "arraybuffer",
    maxContentLength: ctx.maxBytes,
    validateStatus: () => true,
    httpAgent,
    httpsAgent,
  });
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} setelah challenge terpecahkan.`);
  }
  return { data: Buffer.from(res.data), status: res.status, headers: res.headers || {} };
}

/* ------------------------------------------------------------------ *
 * 5. Scraping Browser remote Bright Data (browser asli di DC mereka).
 * ------------------------------------------------------------------ */
async function runScrapingBrowser(ctx) {
  if (ctx.responseType === "buffer") {
    const buffer = await remoteFetchBuffer(ctx.fullUrl, {
      maxBytes: ctx.maxBytes,
      timeoutMs: ctx.timeout,
    });
    return { data: buffer, status: 200, headers: {} };
  }

  const res = await remoteInPageFetch(ctx.fullUrl, {
    method: ctx.method,
    headers: ctx.headers,
    body: ctx.data,
  });
  return { data: normalize(res.data, ctx.responseType), status: res.status || 200, headers: {} };
}

/** Definisi strategi + urutan default. */
export const STRATEGIES = {
  direct: { run: runDirect, available: () => true },
  unlocker: { run: runUnlocker, available: () => isBrightDataEnabled() },
  proxy: { run: runProxy, available: () => Boolean(nativeProxyConfig()) },
  browser: { run: runBrowser, available: () => !browserDisabled() },
  "scraping-browser": { run: runScrapingBrowser, available: () => remoteBrowserAvailable() },
};

export const DEFAULT_ORDER = ["direct", "unlocker", "proxy", "browser", "scraping-browser"];

/** Jalur yang butuh browser stealth saja (tanpa Unlocker) — paling murah. */
export const BROWSER_ONLY_ORDER = ["browser", "direct"];

/**
 * Apakah ada jalur unlocker Bright Data yang siap (REST atau native proxy)?
 * Dipakai agar `via: "brightdata"` tidak memaksa browser lokal saat
 * kredensial Bright Data belum diisi.
 */
export function unlockerPathsAvailable() {
  return isBrightDataEnabled() || Boolean(nativeProxyConfig());
}
