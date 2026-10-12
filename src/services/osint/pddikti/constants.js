export const BASE = "https://pddikti.kemdiktisaintek.go.id";
export const SITEKEY = "6LdqjDstAAAAAMW1whjCNKyvqmPBOIssWETjbLbh";

export const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

export const TOKEN_TIMEOUT_MS = 30000;
export const API_TIMEOUT_MS = 15000;

export const SEARCH_TTL_MS = 5 * 60 * 1000;
export const DETAIL_TTL_MS = 60 * 60 * 1000;
export const searchCache = new Map();
export const detailCache = new Map();

export function cacheGet(map, key) {
  const hit = map.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  map.delete(key);
  return null;
}

export function cacheSet(map, key, data, ttl) {
  map.set(key, { data, expires: Date.now() + ttl });
  if (map.size > 300) map.delete(map.keys().next().value);
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function mapApiError(status, snippet) {
  if (status === 403) return "Ditolak server PDDikti (403). Token expired — coba lagi.";
  if (status === 429) return "Rate-limit PDDikti (429). Tunggu ±1 menit lalu coba lagi.";
  if (status >= 500) return `Server PDDikti error (HTTP ${status}). Coba lagi nanti.`;
  if (status === 404) return "Endpoint PDDikti tidak ditemukan (404).";
  return `PDDikti HTTP ${status}${snippet ? `: ${snippet.slice(0, 150)}` : ""}`;
}

export function neat(v) {
  return String(v ?? "").trim() || "-";
}

export function formatTanggal(tgl) {
  const s = String(tgl ?? "").trim();
  if (!s || s === "-") return "-";
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}/.test(s)) return s;
  try {
    const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return s;
  }
}

export function jkLabel(jk) {
  const s = String(jk ?? "").trim().toUpperCase();
  if (s === "L") return "Laki-laki";
  if (s === "P") return "Perempuan";
  return neat(jk);
}
