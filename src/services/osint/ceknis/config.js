import { settings } from "@/config/settings.js";

const FALLBACK_URL =
  "https://script.google.com/macros/s/AKfycbzFd_CjY2y6jnle9hmlp71nyxy8mscur2tWF8gz773-IthSVkKF3v3Px3viPhPcA4U2mw/exec";

export function getSiswaBaseUrl() {
  const fromEnv = String(process.env.SISWA_API_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const fromSettings = String(settings?.siswaApiUrl || "").trim();
  if (fromSettings) return fromSettings.replace(/\/+$/, "");
  return FALLBACK_URL;
}

export function getSISWA_BASE_URL() {
  return getSiswaBaseUrl();
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const NOTFOUND_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

export function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}

export function cacheSet(key, data, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expires: Date.now() + ttl });
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export { CACHE_TTL_MS, NOTFOUND_TTL_MS };

export const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

export function buildUrl(query, mode = "nis") {
  const q = String(query ?? "").trim();
  const m =
    String(mode ?? "nis")
      .trim()
      .toLowerCase() || "nis";
  return `${getSiswaBaseUrl()}?query=${encodeURIComponent(q)}&mode=${encodeURIComponent(m)}`;
}
