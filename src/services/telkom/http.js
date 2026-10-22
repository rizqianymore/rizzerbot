import { cookieJar as globalCookieJar } from "@/src/utils/request/cookies.js";
import { stealthBrowser } from "@/src/utils/request/browser.js";
import { brightDataRequest, isBrightDataEnabled } from "@/src/services/network/brightdata.js";
import { remoteBrowserEnabled, remoteInPageFetch, remoteSolveChallenge } from "./remote-browser.js";
import { nativeProxyEnabled, proxyRequest } from "./proxy.js";
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
/**
 * Respons 2xx tapi isinya halaman HTML: beberapa proteksi Cloudflare
 * membalas 200 dengan halaman challenge, bukan 403. Harus dianggap challenge.
 */
export function looksLikeChallengeHtml(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower) return false;
  if (!lower.includes("<html") && !lower.includes("<!doctype")) return false;
  return (
    lower.includes("just a moment") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("challenges.cloudflare.com") ||
    lower.includes("checking your browser") ||
    lower.includes("attention required") ||
    lower.includes("enable javascript and cookies") ||
    lower.includes("cloudflare")
  );
}

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
 * Bright Data Web Unlocker sebagai jalur bypass challenge.
 * Config diambil dari .env: BRIGHTDATA_API_KEY + BRIGHTDATA_ZONE.
 * Default: aktif kalau API key tersedia (matikan dengan TELKOM_VIA_BRIGHTDATA=0).
 */
export function brightDataBridgeEnabled() {
  if (String(process.env.TELKOM_VIA_BRIGHTDATA || "1").trim() === "0") return false;
  return isBrightDataEnabled();
}

// Circuit breaker: kalau unlocker unreachable, jangan buang 15 detik tiap request.
let unlockerFailures = 0;
let unlockerDisabledUntil = 0;
const UNLOCKER_TIMEOUT_MS = 12000;
const UNLOCKER_COOLDOWN_MS = 10 * 60 * 1000;
const UNLOCKER_MAX_FAILURES = 2;

function unlockerAvailable() {
  if (Date.now() < unlockerDisabledUntil) return false;
  return true;
}

/** Status circuit breaker (untuk log/monitor). */
export function unlockerStatus() {
  return {
    failures: unlockerFailures,
    disabledUntil: unlockerDisabledUntil,
    available: unlockerAvailable(),
  };
}

/**
 * Coba request lewat Web Unlocker.
 * Mengembalikan null bila tidak tersedia/gagal (eskalasi ke jalur lain).
 */
export async function tryBrightDataUnlock(url, { method = "GET", headers = {}, body, isForm = false } = {}) {
  if (!brightDataBridgeEnabled() || isForm) return null;
  if (!unlockerAvailable()) return null;
  try {
    const text = await brightDataRequest(url, {
      format: "raw",
      method,
      headers: { ...headers },
      data: body === undefined ? undefined : body,
      timeout: UNLOCKER_TIMEOUT_MS,
    });
    const raw = typeof text === "string" ? text : JSON.stringify(text);
    if (!raw) return null;
    // Masih halaman challenge -> Web Unlocker gagal, lanjut jalur lain.
    if (looksLikeChallenge(200, {}, raw)) return null;
    let data = raw;
    try {
      data = JSON.parse(raw);
    } catch (_) {}
    unlockerFailures = 0;
    return { status: 200, data, raw };
  } catch (err) {
    unlockerFailures += 1;
    console.warn(
      `[Telkom] BrightData unlocker gagal (${unlockerFailures}/${UNLOCKER_MAX_FAILURES}): ` +
        `${String(err?.message || err).slice(0, 100)} ` +
        "(cek BRIGHTDATA_API_KEY/ZONE & koneksi ke api.brightdata.com)"
    );
    if (unlockerFailures >= UNLOCKER_MAX_FAILURES) {
      unlockerDisabledUntil = Date.now() + UNLOCKER_COOLDOWN_MS;
      console.warn(
        "[Telkom] BrightData unlocker dinonaktifkan sementara 10 menit (belum terjangkau) — " +
          "loncat ke jalur berikutnya."
      );
    }
    return null;
  }
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
    allowLocalBrowser = true,
    allowThrow = true,
    logger = null,
  } = options;

  const log = (level, message, extra = {}) => {
    const fn = logger?.[level] || logger?.info;
    if (typeof fn !== "function") return;
    try {
      fn.call(logger, `[Telkom] ${message}`, extra);
    } catch (_) {}
  };

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
        // Jalur lain: remote browser BrightData (keluar lewat jaringan BrightData).
        if (attempt >= 1 && remoteBrowserEnabled() && !isForm) {
          const viaRemote = await remoteInPageFetch(url, {
            method,
            headers: buildRequestHeaders({
              token,
              origin,
              referer,
              contentType,
              extra: extraHeaders,
            }),
            body,
          }).catch(() => null);
          if (viaRemote?.ok) {
            log("info", "request sukses via remote browser (fallback network)", {
              url,
              status: viaRemote.status,
            });
            return { status: viaRemote.status, data: viaRemote.data, headers: {}, challenged };
          }
        }
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw err;
    }
    const setCookie = last.headers["set-cookie"];
    if (setCookie) storeMemoryCookies(url, setCookie);

    if (last.status >= 200 && last.status < 400) {
      // 2xx tapi isinya halaman challenge -> perlakukan sebagai challenge.
      if (typeof last.data === "string" && looksLikeChallengeHtml(last.data)) {
        challenged = true;
        log("warn", "respons 200 tapi isinya halaman challenge", { url, status: last.status });
        // lanjut ke eskalasi di bawah
      } else {
        return { status: last.status, data: last.data, headers: last.headers, challenged };
      }
    } else {
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
    }
    log("warn", "challenge terdeteksi, eskalasi", {
      url,
      status: last.status,
      attempt,
    });

    // B1. clearance dari cookie jar (hasil challenge sebelumnya)
    if (attempt < 2) {
      const cached = mergedCookie(url, cookie);
      if (cached && cached !== headers.Cookie) {
        headers.Cookie = cached;
        await sleep(400);
        continue;
      }
    }

    // B2. Bright Data native proxy (Web Unlocker lewat proxy 44445).
    if (allowBrowser && attempt < 3 && nativeProxyEnabled()) {
      try {
        const viaProxy = await proxyRequest(url, {
          method,
          headers: buildRequestHeaders({
            token,
            origin,
            referer,
            contentType: isForm ? "" : contentType,
            extra: extraHeaders,
          }),
          body: isForm ? body : body,
          isForm,
          timeoutMs: 25000,
        });
        if (viaProxy.status >= 200 && viaProxy.status < 400) {
          log("info", "request sukses via Bright Data native proxy", {
            url,
            status: viaProxy.status,
          });
          return {
            status: viaProxy.status,
            data: viaProxy.data,
            headers: viaProxy.headers,
            challenged,
          };
        }
        if (viaProxy.status === 401 || viaProxy.status === 403) {
          log("warn", "native proxy menjawab 401/403 - Authorization kemungkinan tidak diteruskan proxy", {
            url,
            status: viaProxy.status,
          });
        } else {
          log("warn", "native proxy menolak request", { url, status: viaProxy.status });
        }
      } catch (err) {
        log("warn", `native proxy error: ${String(err?.message || err).slice(0, 140)}`);
      }
    }

    // B3. Bright Data Scraping Browser (remote, IP bersih) — jalur utama.
    if (allowBrowser && attempt < 3 && remoteBrowserEnabled()) {
      try {
        const target = origin || new URL(url).origin;
        const solved = await remoteSolveChallenge(target);
        log("info", "remote browser: challenge dicek", {
          url,
          cleared: solved?.cleared,
        });
        if (solved?.cleared) {
          for (const cookie of solved.cookies || []) {
            storeMemoryCookies(url, `${cookie.name}=${cookie.value}`);
          }
          const fresh = mergedCookie(url, cookie);
          if (fresh) {
            headers.Cookie = fresh;
            await sleep(400);
            continue;
          }
        }
      } catch (err) {
        log("warn", `remote browser error: ${String(err?.message || err).slice(0, 140)}`);
      }

      // Request API langsung dari dalam remote browser (bisa pakai header auth).
      if (!isForm) {
        try {
          const inPage = await remoteInPageFetch(url, {
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
          if (inPage?.ok && inPage.status >= 200 && inPage.status < 400) {
            log("info", "request sukses via remote browser", { url, status: inPage.status });
            return { status: inPage.status, data: inPage.data, headers: {}, challenged };
          }
        } catch (err) {
          log("warn", `remote in-page fetch gagal: ${String(err?.message || err).slice(0, 140)}`);
        }
      }
    }

    // B4. Bright Data Web Unlocker (REST, lebih murah)
    //     PENTING: Web Unlocker tidak meneruskan header Authorization ->
    //     jangan dipakai untuk request API yang butuh token siswa
    //     (akibatnya server membalas "Invalid token").
    if (allowBrowser && attempt < 3 && !token) {
      const unlocked = await tryBrightDataUnlock(url, {
        method,
        headers: buildRequestHeaders({
          token,
          origin,
          referer,
          contentType: isForm ? "" : contentType,
          extra: extraHeaders,
        }),
        body: isForm ? undefined : body,
        isForm,
      });
      if (unlocked) {
        log("info", "challenge teratasi via Bright Data Web Unlocker", { url });
        return { status: unlocked.status, data: unlocked.data, headers: {}, challenged };
      }
      log("info", "Bright Data tidak resolving, lanjut browser stealth", { url });
    } else if (token) {
      log("info", "Web Unlocker dilewati (tidak meneruskan Authorization) - pakai proxy/remote browser", { url });
    }

    if (allowBrowser && attempt < 3) {
      // B5. escalation ke browser stealth (lokal) untuk mendapat clearance baru
      //     (opsional: bisa dimatikan supaya RAM server tetap ringan)
      try {
        if (!allowLocalBrowser) throw new Error("local browser dimatikan");
        const target = origin || new URL(url).origin;
        const solved = await stealthBrowser.solveChallenge(target, { timeoutMs: 25000 });
        if (solved?.cleared) {
          const fresh = mergedCookie(url, cookie);
          log("info", "challenge teratasi via browser stealth", { url, type: solved.type });
          if (fresh) {
            headers.Cookie = fresh;
            await sleep(500);
            continue;
          }
        } else {
          log("warn", "browser stealth tidak berhasil clear challenge", {
            url,
            type: solved?.type,
          });
        }
      } catch (err) {
        log("warn", `browser stealth error: ${String(err?.message || err).slice(0, 120)}`);
      }

      // B6. terakhir: jalankan request dari dalam browser (hanya untuk body JSON)
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
