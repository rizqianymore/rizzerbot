/**
 * Orkestrator anti-protection.
 *
 * `protectedFetch()` mencoba beberapa jalur sampai salah satu berhasil:
 *
 *   direct -> unlocker (REST) -> proxy (native Web Unlocker)
 *          -> browser (stealth lokal) -> scraping-browser (remote BrightData)
 *
 * Naik level otomatis saat:
 *   - status 401/403/406/418/429 (kemungkinan proteksi)
 *   - halaman challenge terdeteksi (Cloudflare, DataDome, Incapsula, ...)
 *   - error jaringan / server error (5xx)
 *
 * Naik level TIDAK terjadi bila status 404/410 (memang tidak ada) supaya
 * kuota Bright Data tidak terbuang percuma.
 */

import { DEFAULT_ORDER, STRATEGIES, buildFullUrl, unlockerPathsAvailable } from "./chain.js";
import { classifyStatus, detectErrorProtection, detectResponseProtection, protectionLabel } from "./detect.js";

const TRANSIENT_STATUS = new Set([408, 429, 502, 503, 504]);

function isTransientError(err) {
  const message = String(err?.message || "");
  const statusMatch = message.match(/HTTP (\d{3})/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
  return (
    err?.code === "ECONNRESET" ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ECONNABORTED" ||
    /timeout|timed out|socket hang up/i.test(message) ||
    TRANSIENT_STATUS.has(statusCode)
  );
}

function brightDataFirstHosts() {
  return String(process.env.BRIGHTDATA_FIRST_HOSTS || "")
    .split(",")
    .map(
      (h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//i, "")
          .split("/")[0]
    )
    .filter(Boolean);
}

/** Apakah host ini masuk daftar "pakai Bright Data dulu"? */
export function isBrightDataFirstHost(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return brightDataFirstHosts().some((h) => host === h || host.endsWith(`.${h}`));
  } catch (_) {
    return false;
  }
}

/**
 * Susun urutan strategi sesuai preferensi pemanggil.
 * @returns {string[]}
 */
export function resolveStrategyOrder(options = {}) {
  const via = String(options.via || "auto").toLowerCase();
  const bypass = options.bypassCloudflare ?? "auto";
  const hasUnlocker = unlockerPathsAvailable();

  if (via === "direct") return ["direct"];
  if (via === "browser") return ["browser", "direct"];

  // "brightdata" = dahulukan jalur unlocker. Kalau kredensial Bright Data
  // belum diisi, jangan paksa browser lokal — pakai urutan biasa saja.
  if (via === "brightdata") {
    return hasUnlocker ? ["unlocker", "proxy", "browser", "scraping-browser", "direct"] : [...DEFAULT_ORDER];
  }

  if (bypass === false) return ["direct"];
  if (bypass === true) {
    return hasUnlocker
      ? ["unlocker", "proxy", "browser", "scraping-browser", "direct"]
      : ["browser", "scraping-browser", "direct"];
  }
  if (isBrightDataFirstHost(options.url)) {
    return hasUnlocker ? ["unlocker", "proxy", "browser", "scraping-browser", "direct"] : [...DEFAULT_ORDER];
  }
  return [...DEFAULT_ORDER];
}

function buildContext(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const responseType = options.responseType || "json";
  return {
    url: String(url),
    fullUrl: buildFullUrl(url, options.params),
    method,
    responseType,
    headers: options.headers || {},
    data: options.data,
    params: options.params,
    timeout: Number(options.timeout) > 0 ? Number(options.timeout) : 15000,
    maxBytes: Number(options.maxBytes) > 0 ? Number(options.maxBytes) : 40 * 1024 * 1024,
    retries: options.retries !== undefined ? Number(options.retries) : 2,
    country: options.country,
    state: options.state,
    city: options.city,
    preferredDevice: options.preferredDevice || "desktop",
  };
}

/**
 * Ambil resource dengan eskalasi anti-protection otomatis.
 *
 * @param {string} url target
 * @param {object} options lihat `buildContext` + `resolveStrategyOrder`
 * @returns {Promise<{data: any, via: string, protection: object|null, attempts: string[]}>}
 */
export async function protectedFetchWithMeta(url, options = {}) {
  const ctx = buildContext(url, options);
  const order = resolveStrategyOrder({ ...options, url });
  const attempts = [];
  let lastError = null;
  let lastProtection = null;

  const note = (entry) => {
    attempts.push(entry);
    if (typeof options.onAttempt === "function") {
      try {
        options.onAttempt(entry);
      } catch (_) {}
    }
  };

  for (const via of order) {
    const strategy = STRATEGIES[via];
    if (!strategy) continue;

    let available = false;
    try {
      available = strategy.available();
    } catch (_) {
      available = false;
    }
    if (!available) continue;

    let attempt = 0;
    while (attempt <= ctx.retries) {
      attempt++;
      try {
        const res = await strategy.run(ctx);
        const statusKind = classifyStatus(res.status);
        const protection = detectResponseProtection({
          status: res.status,
          headers: res.headers,
          data: res.data,
        });

        if (statusKind === "notfound") {
          const err = new Error(`HTTP 404 — sumber tidak ditemukan (${url})`);
          err.status = 404;
          err.attempts = attempts;
          throw err;
        }

        if (statusKind === "blocked" || protection.blocked) {
          lastProtection = protection;
          note(`${via}:protected`);
          if (options.bypassCloudflare === false) {
            const err = new Error(`Protection challenge detected (HTTP ${res.status}) and bypass is disabled.`);
            err.protection = protection;
            throw err;
          }
          break; // eskalasi ke strategi berikutnya
        }

        if (statusKind === "server") {
          lastError = new Error(`HTTP ${res.status} dari ${via}`);
          note(`${via}:http${res.status}`);
          if (attempt <= ctx.retries) {
            await new Promise((r) => setTimeout(r, 600 * attempt));
            continue;
          }
          break;
        }

        note(`${via}:ok`);
        if (typeof options.onVia === "function") {
          try {
            options.onVia(via);
          } catch (_) {}
        }
        return { data: res.data, via, protection: null, attempts };
      } catch (err) {
        if (err?.status === 404) throw err;
        lastError = err;
        const protection = detectErrorProtection(err);
        if (protection.blocked) {
          lastProtection = protection;
          note(`${via}:blocked`);
          break;
        }
        if (isTransientError(err) && attempt <= ctx.retries) {
          note(`${via}:retry${attempt}`);
          await new Promise((r) => setTimeout(r, 800 * attempt));
          continue;
        }
        note(`${via}:error`);
        break;
      }
    }
  }

  const detail = lastProtection?.type ? ` (proteksi: ${protectionLabel(lastProtection.type)})` : "";
  const err = new Error(`${lastError?.message || `Gagal mengambil ${url}`}${detail}`);
  err.protection = lastProtection || null;
  err.attempts = attempts;
  throw err;
}

/**
 * Versi ringkas: hanya mengembalikan datanya.
 * @returns {Promise<any>}
 */
export async function protectedFetch(url, options = {}) {
  const result = await protectedFetchWithMeta(url, options);
  return result.data;
}

export { detectResponseProtection, detectErrorProtection, classifyStatus, protectionLabel };
export { STRATEGIES, DEFAULT_ORDER, buildFullUrl };

export default {
  protectedFetch,
  protectedFetchWithMeta,
  resolveStrategyOrder,
  isBrightDataFirstHost,
  detectResponseProtection,
  detectErrorProtection,
  classifyStatus,
  protectionLabel,
};
