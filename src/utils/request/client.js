import { cookieJar } from "./cookies.js";
import { getRandomDevice } from "./devices.js";
import { buildScraperHeaders } from "./headers.js";
import { stealthBrowser } from "./browser.js";
import { protectedFetchWithMeta } from "@/src/services/network/scraper/index.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_BUFFER_MAX_BYTES = 40 * 1024 * 1024;

const inflight = new Map();

function dedupKey(url, { responseType, via, bypassCloudflare, country, state, city, params }) {
  let full = String(url);
  try {
    const u = new URL(full);
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
    }
    full = u.toString();
  } catch (_) {}
  return [via || "auto", bypassCloudflare || "auto", responseType, country || "", state || "", city || "", full].join(
    "|"
  );
}

/**
 * Request HTTP dengan rantai anti-protection otomatis.
 *
 * Jalur yang dicoba berurutan (lihat `src/services/network/scraper/`):
 *   direct -> Web Unlocker (REST) -> native proxy -> browser stealth -> Scraping Browser
 *
 * Opsi penting:
 *   - `via`: "auto" | "direct" | "brightdata" | "browser"
 *   - `bypassCloudflare`: "auto" | true | false
 *   - `onVia`: callback(wia) saat jalur yang dipakai diketahui
 */
export async function smartRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const responseType = options.responseType || "json";
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const bypassCloudflare = options.bypassCloudflare !== undefined ? options.bypassCloudflare : "auto";
  const preferredDevice = options.preferredDevice || "any";
  const onVia = typeof options.onVia === "function" ? options.onVia : null;

  const device = getRandomDevice(preferredDevice);
  const defaultHeaders = buildScraperHeaders(device);

  const cookiesStr = cookieJar.getCookieString(url);
  const headers = {
    ...defaultHeaders,
    ...(cookiesStr ? { Cookie: cookiesStr } : {}),
    ...(options.headers || {}),
  };

  const canDedup =
    method === "GET" &&
    (responseType === "json" || responseType === "text") &&
    options.dedup !== false &&
    options.data === undefined &&
    bypassCloudflare === "auto" &&
    options.via !== "brightdata";
  const key = canDedup
    ? dedupKey(url, {
        responseType,
        via: options.via,
        bypassCloudflare,
        country: options.country,
        state: options.state,
        city: options.city,
        params: options.params,
      })
    : null;
  if (key && inflight.has(key)) return inflight.get(key);

  const run = (async () => {
    const result = await protectedFetchWithMeta(url, {
      method,
      headers,
      data: options.data,
      params: options.params,
      timeout,
      responseType,
      retries: options.retries,
      maxBytes: options.maxBytes || DEFAULT_BUFFER_MAX_BYTES,
      country: options.country,
      state: options.state,
      city: options.city,
      via: options.via,
      bypassCloudflare,
      preferredDevice,
      onVia,
      onAttempt: options.onAttempt,
    });
    return result.data;
  })();

  if (!key) return run;
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    if (inflight.get(key) === run) inflight.delete(key);
  }
}

export const request = smartRequest;
request.get = (url, options = {}) => smartRequest(url, { ...options, method: "GET" });
request.post = (url, data, options = {}) => smartRequest(url, { ...options, method: "POST", data });
request.json = (url, options = {}) => smartRequest(url, { ...options, responseType: "json" });
request.text = (url, options = {}) => smartRequest(url, { ...options, responseType: "text" });
request.buffer = (url, options = {}) => smartRequest(url, { ...options, responseType: "buffer" });
request.browser = (url, options = {}) => smartRequest(url, { ...options, bypassCloudflare: true });
request.clearCookies = (domain) => {
  if (domain) cookieJar.clearDomain(domain);
  else cookieJar.clearAll();
};
request.closeBrowser = () => stealthBrowser.close();

export default request;
