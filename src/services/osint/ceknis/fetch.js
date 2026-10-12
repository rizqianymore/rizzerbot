import { getSiswaBaseUrl, cacheGet, cacheSet, NOTFOUND_TTL_MS, CACHE_TTL_MS, UA, buildUrl } from "./config.js";

export function parseNisQuery(rawInput) {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return { valid: false, reason: "input kosong" };
  const query = raw.split(/[\s,;|]+/)[0].trim();
  if (!/^[0-9]{5,20}$/.test(query)) {
    return {
      valid: false,
      reason: "format NIS salah. Harus 5-20 digit angka. Contoh: .ceknis 539241249",
      query,
    };
  }
  return { valid: true, query };
}

export function parseMultiNis(rawInput, max = 5) {
  const tokens = String(rawInput ?? "")
    .split(/[\s,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  for (const t of tokens) {
    const clean = t.replace(/\D/g, "");
    if (/^[0-9]{5,20}$/.test(clean)) {
      if (!seen.has(clean)) {
        seen.add(clean);
        if (valid.length < max) valid.push(clean);
      }
    } else {
      invalid.push(t);
    }
    if (valid.length >= max) break;
  }
  return { valid, invalid, truncated: tokens.length > valid.length + invalid.length || valid.length === max };
}

async function fetchWithRedirect(url, { timeoutMs = 10000, maxRedirects = 5 } = {}) {
  let currentUrl = url;
  let redirects = 0;

  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect ${res.status} tanpa header Location (kemungkinan deployment GAS expired)`);
      if (redirects >= maxRedirects) throw new Error("Terlalu banyak redirect (>5, user_content_key mungkin expired)");
      currentUrl = new URL(location, currentUrl).toString();
      redirects++;
      try {
        await res.arrayBuffer();
      } catch (_) {}
      continue;
    }

    return res;
  }
}

function mapHttpError(status, snippet) {
  const s = String(snippet || "").toLowerCase();
  if (status === 429) return "Limit Google Apps Script habis (429). Tunggu 1-2 menit lalu coba lagi.";
  if (status === 403 || status === 401) return "Akses GAS ditolak (403). Deployment mungkin diganti ke private.";
  if (status === 404) return "Endpoint GAS tidak ditemukan (404). Deployment ID mungkin sudah redeploy.";
  if (status >= 500) return `Server Google error (HTTP ${status}). Coba lagi 1-2 menit.`;
  if (s.includes("<html") || s.includes("google drive") || s.includes("apps script"))
    return `GAS mengembalikan halaman error (HTTP ${status}). Kemungkinan kuota / script error.`;
  return `HTTP ${status}${snippet ? `: ${snippet.slice(0, 150)}` : ""}`;
}

async function parseJsonResponse(res) {
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(mapHttpError(res.status, snippet));
  }
  const text = (await res.text()).trim();
  if (!text) throw new Error("Respon kosong dari server (kemungkinan GAS timeout)");
  try {
    return JSON.parse(text);
  } catch (_) {
    if (text.startsWith("<")) throw new Error("GAS mengembalikan HTML bukan JSON (kuota habis / deployment error)");
    throw new Error("Respon bukan JSON valid");
  }
}

function normalizeRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.results)) return json.results;
  if (json && typeof json === "object" && (json.NIS || json["NAMA SISWA"])) return [json];
  return [];
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchSiswaByNis(nis, mode = "nis", { retries = 1 } = {}) {
  const query = String(nis ?? "").trim();
  const m = String(mode ?? "nis").trim().toLowerCase() || "nis";
  if (!query) throw new Error("NIS wajib diisi");

  const cacheKey = `${getSiswaBaseUrl()}|${m}:${query}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = buildUrl(query, m);
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithRedirect(url);
      const json = await parseJsonResponse(res);
      const rows = normalizeRows(json);
      cacheSet(cacheKey, rows, rows.length === 0 ? NOTFOUND_TTL_MS : CACHE_TTL_MS);
      return rows;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || "");
      const retryable =
        err?.name === "AbortError" || /429|5\d\d|timeout|Timeout|ECONN|fetch failed/i.test(msg);
      if (retryable && attempt < retries) {
        await delay(800 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  // Fallback Bright Data Web Unlocker jika GAS diblokir IP atau rate-limited
  try {
    const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/network/brightdata.js");
    if (getBrightDataConfig().apiKey) {
      const bdRes = await brightDataRequest(url, { format: "json", timeout: 30000 });
      const rows = normalizeRows(bdRes);
      cacheSet(cacheKey, rows, rows.length === 0 ? NOTFOUND_TTL_MS : CACHE_TTL_MS);
      return rows;
    }
  } catch (_) {}

  throw lastErr;
}
