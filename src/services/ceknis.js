// src/services/ceknis.js — lookup data siswa via Google Apps Script (mode=nis).
// Endpoint: GET <base>/exec?query=<nis>&mode=nis
// Flow: 302 Found -> Location: https://script.googleusercontent.com/macros/echo?... -> 200 application/json [...]
// Base URL priority: env SISWA_API_URL > config/settings.js > hardcoded fallback.

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

export const SISWA_BASE_URL = FALLBACK_URL;

const CACHE_TTL_MS = 5 * 60 * 1000;
const NOTFOUND_TTL_MS = 30 * 60 * 1000;
const cache = new Map(); // key -> { data, expires }

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}

function cacheSet(key, data, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, expires: Date.now() + ttl });
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

function buildUrl(query, mode = "nis") {
  const q = String(query ?? "").trim();
  const m = String(mode ?? "nis").trim().toLowerCase() || "nis";
  return `${getSiswaBaseUrl()}?query=${encodeURIComponent(q)}&mode=${encodeURIComponent(m)}`;
}

/**
 * Validasi 1 NIS. Contoh valid: 539241249 (9 digit).
 * Longgar 5-20 digit agar tidak false-negative antar angkatan.
 */
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

/** Parse multi-NIS: ".ceknis 539241249, 539241250 539241251" -> max 5, dedup. */
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

/**
 * Fetch dengan penanganan 302 manual.
 * script.google.com selalu balas 302 + Location ke script.googleusercontent.com
 * dengan body kosong. fetch `follow` default sebenarnya cukup, tapi manual agar:
 *  - timeout per-hop (bukan per chain)
 *  - header browser diteruskan ke hop berikutnya
 *  - tidak hang saat chain panjang / user_content_key expired
 */
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

/**
 * Ambil data siswa by NIS dengan retry transient (429/5xx/timeout).
 * Return array (kosong = tidak ditemukan). Cache hit termasuk empty (TTL lebih panjang).
 */
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
  throw lastErr;
}

function neat(v) {
  const s = String(v ?? "").trim();
  return s || "-";
}

/** Masking No HP: 6281291477354 -> 6281****7354. Full hanya untuk owner/admin. */
export function maskPhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "-";
  if (d.length <= 7) return `${d.slice(0, 2)}****`;
  return `${d.slice(0, 4)}****${d.slice(-4)}`;
}

export function formatSiswa(row, { showFullPhone = true } = {}) {
  const phone = neat(row["NO HP"]);
  const phoneShown = showFullPhone ? phone : phone === "-" ? "-" : maskPhone(phone);
  const lines = [];
  lines.push(`*DATA SISWA*`);
  lines.push(`No: ${neat(row.NO)}`);
  lines.push(`Nama: ${neat(row["NAMA SISWA"])}`);
  lines.push(`NIS: ${neat(row.NIS)}`);
  lines.push(`Kelas: ${neat(row.KELAS)}`);
  lines.push(`Tema: ${neat(row.TEMA)}`);
  lines.push(`Judul: ${neat(row.JUDUL)}`);
  lines.push(`Pembimbing: ${neat(row["GURU PEMBIMBING"])}`);
  lines.push(`No HP: ${phoneShown}`);
  const status = String(row.STATUS ?? "").trim();
  if (status) lines.push(`Status: ${status}`);
  return lines.join("\n");
}

/**
 * Satu panggilan untuk plugin single-NIS.
 * @param {object} opts - { showFullPhone, logger }
 */
export async function getSiswaInfoText(input, mode = "nis", opts = {}) {
  const parsed = parseNisQuery(input);
  if (!parsed.valid) return { error: parsed.reason };
  try {
    const rows = await fetchSiswaByNis(parsed.query, mode);
    if (!rows || rows.length === 0) {
      return { error: `Data NIS "${parsed.query}" tidak ditemukan.` };
    }
    if (rows.length === 1) return { text: formatSiswa(rows[0], opts) };
    const shown = rows.slice(0, 10);
    const out = [`*DATA SISWA (${rows.length} hasil)*`, ``];
    shown.forEach((r, i) => {
      out.push(`${i + 1}. *${neat(r["NAMA SISWA"])}* — NIS: ${neat(r.NIS)} | ${neat(r.KELAS)}`);
    });
    if (rows.length > 10) out.push(`_... dan ${rows.length - 10} lainnya. Persempit dengan NIS spesifik._`);
    out.push(``, `Detail: \`.ceknis <nis>\``);
    return { text: out.join("\n") };
  } catch (err) {
    opts?.logger?.warn?.(`[ceknis] gagal nis=${parsed.query}: ${err.message}`);
    if (err?.name === "AbortError") return { error: "Timeout menghubungi server data (10 dtk). Coba lagi." };
    return { error: `Gagal mengambil data: ${err.message}` };
  }
}

/** Bulk: fetch paralel max 5 NIS sekaligus (dipakai plugin multi-query). */
export async function getMultiSiswaInfoText(nisList, opts = {}) {
  const unique = [...new Set(nisList)].slice(0, 5);
  const results = await Promise.all(
    unique.map(async (nis) => {
      try {
        const rows = await fetchSiswaByNis(nis, "nis");
        if (!rows?.length) return { nis, error: "tidak ditemukan" };
        return { nis, text: formatSiswa(rows[0], opts) };
      } catch (err) {
        return { nis, error: err.message };
      }
    })
  );
  return results;
}
