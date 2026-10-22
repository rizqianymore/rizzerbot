import { cookieJar as globalCookieJar } from "@/src/utils/request/cookies.js";
import { stealthBrowser } from "@/src/utils/request/browser.js";
import { UA } from "./config.js";

/**
 * Lapisan HTTP khusus Telkom Schools.
 *
 * Menangani dua jenis proteksi secara otomatis (tanpa konfigurasi manual):
 *   A. Session bootstrap — server app balas 403 + stub JS redirect lalu
 *      memberi cookie sesi. Bot follow cookie itu dan mengulang request.
 *   B. Cloudflare challenge — "Just a moment..." / 503 / cf-mitigated.
 *      Bot mencoba clearance dari cookie jar, naik ke browser stealth,
 *      lalu terakhir menjalankan request dari dalam browser.
 *
 * Cookie modul ini disimpan di MEMORI saja (tidak pernah ditulis ke disk).
 */

export class TelkomHttpError extends Error {
  constructor(message, { status = 0, code = "http_error", body = null, challenged = false } = {}) {
    super(message);
    this.name = "TelkomHttpError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.challenged = challenged;
  }
}

const CHALLENGE_HINTS = [
  "just a moment",
  "cf-browser-verification",
  "challenges.cloudflare.com",
  "checking your browser",
  "attention required",
  "cf_chl_opt",
  "cf-turnstile",
  "cf-challenge",
];

/** Cookie in-memory per host (tidak pernah ditulis ke disk). */
const memoryJar = new Map();

function hostKey(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_) {
    return String(url || "").toLowerCase();
  }
}

export function readMemoryCookies(url) {
  const jar = memoryJar.get(hostKey(url));
  if (!jar || !jar.size) return "";
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function storeMemoryCookies(url, setCookieHeader) {
  if (!setCookieHeader) return;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const key = hostKey(url);
  if (!memoryJar.has(key)) memoryJar.set(key, new Map());
  const jar = memoryJar.get(key);
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const pair = entry.split(";")[0].trim();
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

/** Gabungkan cookie eksplisit + cookie memory + cookie global (cf_clearance). */
function mergedCookie(url, explicit) {
  const parts = [];
  const seen = new Set();
  for (const source of [explicit, readMemoryCookies(url), globalCookieJar.getCookieString(url)]) {
    for (const pair of String(source || "").split(";")) {
      const name = pair.split("=")[0]?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      parts.push(pair.trim());
    }
  }
  return parts.join("; ");
}

/** Header Cloudflare yang menandai respons benar-benar di-challenge. */
function challengeHeader(headers = {}) {
  const h = {};
  for (const [key, value] of Object.entries(headers || {})) {
    h[String(key).toLowerCase()] = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  }
  if (String(h["cf-mitigated"] || "").toLowerCase() === "challenge") return true;
  if (h["cf-chl-bypass"] || h["cf_chl_opt"]) return true;
  if (/\b__cf_bm\b/.test(h["set-cookie"] || "") && /just a moment|challenge/i.test(h["set-cookie"] || "")) {
    return true;
  }
  return false;
}

/**
 * Deteksi proteksi Cloudflare yang BENAR.
 *
 * Catatan: header `cf-ray` / `server: cloudflare` muncul di SEMUA respons API
 * yang lewat Cloudflare (termasuk 401 biasa), jadi tidak boleh dipakai sendiri
 * sebagai penanda challenge. Kriteria: status 403/503/429 + body/header yang
 * memang berisi halaman challenge.
 */
export function looksLikeChallenge(status, headers, body) {
  const code = Number(status) || 0;
  const text = String(body || "").toLowerCase();
  const isHtml = text.includes("<html") || text.includes("<!doctype");
  const hasHint = CHALLENGE_HINTS.some((hint) => text.includes(hint));
  const headerSays = challengeHeader(headers);

  if (code === 403 || code === 503) {
    if (headerSays) return true;
    return hasHint && isHtml;
  }

  if (code === 429) {
    return hasHint || headerSays;
  }

  return false;
}

/**
 * Stub "session bootstrap": 403 + redirect JS + cookie sesi baru.
 * Contoh respons resmi: <script> window.location.href ="/siswa/presensi"; </script>
 */
export function looksLikeSessionStub(status, body, setCookieHeader) {
  if (Number(status) !== 403) return false;
  const text = String(body || "").toLowerCase();
  if (!text.includes("window.location.href")) return false;
  if (setCookieHeader) return true;
  return text.includes("server_session");
}

/** Host yang dipakai modul telkom (cookie-nya tidak boleh tertinggal di disk). */
const TELKOM_HOSTS = [
  "presensi.telkomschools.sch.id",
  "digits.telkomschools.sch.id",
  "gw-digits.telkomschools.sch.id",
  "gateway.ypt.or.id",
];

/**
 * Bersihkan cookie telkom dari jar global (disimpan di disk) + jar memori.
 * Dipanggil setelah alur selesai supaya tidak ada sesi yang tertinggal.
 */
export function clearTelkomCookies() {
  for (const host of TELKOM_HOSTS) {
    memoryJar.delete(host);
    try {
      globalCookieJar.clearDomain(host);
    } catch (_) {}
  }
}

function mergeHeaders(base = {}) {
  const out = {};
  for (const [key, value] of Object.entries(base || {})) {
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export function buildRequestHeaders({ token = "", origin = "", referer = "", contentType = "", extra = {} } = {}) {
  return mergeHeaders({
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": UA,
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(origin ? { Origin: origin } : {}),
    ...(referer ? { Referer: referer } : {}),
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(extra || {}),
  });
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

function errorMessage(status, data) {
  if (data && typeof data === "object") {
    return String(data.message || data.error || data.status || `HTTP ${status}`);
  }
  if (typeof data === "string" && data.trim()) return data.trim().slice(0, 160);
  return `HTTP ${status}`;
}

async function rawFetch(url, { method, headers, body, timeoutMs, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : body,
      signal: controller.signal,
    });
    const text = await res.text();
    const headerMap = {};
    for (const [key, value] of res.headers.entries()) headerMap[key] = value;
    return { status: res.status, headers: headerMap, text, data: parseBody(text) };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new TelkomHttpError("Timeout saat menghubungi server Telkom Schools.", { code: "timeout" });
    }
    throw new TelkomHttpError(`Gagal terhubung ke server Telkom Schools: ${err?.message || err}`, {
      code: "network",
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request ke server Telkom Schools dengan penanganan proteksi otomatis.
 *
 * @param {string} url
 * @returns {Promise<{status:number, data:any, headers:object, challenged:boolean}>}
 */
export async function telkomRequest(url, options = {}) {
  const {
    method = "GET",
    token = "",
    cookie = "",
    origin = "",
    referer = "",
    contentType = "",
    extraHeaders = {},
    body,
    timeoutMs = 20000,
    signal,
    allowBrowser = true,
    allowThrow = true,
  } = options;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = buildRequestHeaders({
    token,
    origin,
    referer,
    contentType: isForm ? "" : contentType,
    extra: extraHeaders,
  });

  const send = () =>
    rawFetch(url, {
      method,
      headers,
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
      timeoutMs,
      signal,
    });

  let last = null;
  let challenged = false;
  let stubRetries = 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const jarCookie = mergedCookie(url, cookie);
    if (jarCookie) headers.Cookie = jarCookie;

    try {
      last = await send();
    } catch (err) {
      // Koneksi ke edge Cloudflare kadang timeout (mis. IPv6 bermasalah).
      // Coba lagi dengan jeda pendek selama masih ada sisa waktu.
      if (err?.code === "network" && attempt < 3 && !signal?.aborted) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw err;
    }
    const setCookie = last.headers["set-cookie"];
    if (setCookie) storeMemoryCookies(url, setCookie);

    if (last.status >= 200 && last.status < 400) {
      return { status: last.status, data: last.data, headers: last.headers, challenged };
    }

    // A. Session bootstrap: ulang request dengan cookie sesi yang baru didapat.
    if (looksLikeSessionStub(last.status, last.text, setCookie) && stubRetries < 2) {
      stubRetries++;
      await sleep(250);
      continue;
    }

    // B. Cloudflare challenge.
    if (!looksLikeChallenge(last.status, last.headers, last.text)) {
      if (allowThrow) {
        throw new TelkomHttpError(errorMessage(last.status, last.data), {
          status: last.status,
          code: "api_error",
          body: last.data,
        });
      }
      return { status: last.status, data: last.data, headers: last.headers, challenged };
    }

    challenged = true;

    // B1. clearance dari cookie jar (hasil challenge sebelumnya)
    if (attempt < 2) {
      const cached = mergedCookie(url, cookie);
      if (cached && cached !== headers.Cookie) {
        headers.Cookie = cached;
        await sleep(400);
        continue;
      }
    }

    // B2. escalation ke browser stealth untuk mendapat clearance baru
    if (allowBrowser && attempt < 3) {
      try {
        const target = origin || new URL(url).origin;
        const solved = await stealthBrowser.solveChallenge(target, { timeoutMs: 25000 });
        if (solved?.cleared) {
          const fresh = mergedCookie(url, cookie);
          if (fresh) {
            headers.Cookie = fresh;
            await sleep(500);
            continue;
          }
        }
      } catch (_) {
        // lanjut ke fallback browser fetch
      }

      // B3. terakhir: jalankan request dari dalam browser (hanya untuk body JSON)
      if (!isForm) {
        try {
          const inPage = await stealthBrowser.inPageFetch(url, {
            method,
            headers: buildRequestHeaders({
              token,
              origin,
              referer,
              contentType,
              extra: extraHeaders,
            }),
            body,
          });
          if (inPage && inPage.status >= 200 && inPage.status < 400) {
            return { status: inPage.status, data: inPage.data, headers: {}, challenged };
          }
        } catch (_) {
          // gagal — lempar error challenge di bawah
        }
      }
    }

    await sleep(700 * (attempt + 1));
  }

  throw new TelkomHttpError(`Proteksi Cloudflare tidak teratasi (HTTP ${last?.status || 0}). Coba lagi nanti.`, {
    status: last?.status || 0,
    code: "challenge",
    body: last?.data,
    challenged: true,
  });
}
