import { request } from "@/src/utils/request.js";

const F1_BASE = "https://f1api.dev/api";
const FETCH_TIMEOUT_MS = 15000;

const cache = new Map();
export function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}
export function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}

export async function fetchJSON(path) {
  const cached = cacheGet(`json:${path}`);
  if (cached) return cached;
  let data;
  try {
    data = await request.json(`${F1_BASE}${path}`, { timeout: FETCH_TIMEOUT_MS });
  } catch (err) {
    if (/HTTP 404\b/.test(err?.message || "")) {
      let msg = "Data tidak ditemukan (404).";
      try {
        const j = JSON.parse(String(err.message).replace(/^HTTP 404:\s*/, ""));
        if (j?.message) msg = j.message;
      } catch (_) {}
      throw new Error(msg);
    }
    throw err;
  }

  const dynamic = /championship|current|last|next|\/\d{4}\//.test(path);
  cacheSet(`json:${path}`, data, dynamic ? 10 * 60 * 1000 : 12 * 60 * 60 * 1000);
  return data;
}

export async function fetchAllList(listPath, listKey, { pageSize = 100, maxTotal = 1200 } = {}) {
  const cacheKey = `all:${listPath}:${listKey}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;
  const out = [];
  for (let offset = 0; offset < maxTotal; offset += pageSize) {
    const sep = listPath.includes("?") ? "&" : "?";
    const data = await fetchJSON(`${listPath}${sep}limit=${pageSize}&offset=${offset}`);
    const arr = data?.[listKey] || [];
    if (!Array.isArray(arr) || arr.length === 0) break;
    out.push(...arr);
    if (arr.length < pageSize) break;
  }
  cacheSet(cacheKey, out, 12 * 60 * 60 * 1000);
  return out;
}

export const norm = (s) => String(s ?? "").toLowerCase();
export function matchDriver(d, q) {
  const query = norm(q);
  return [d.driverId, d.name, d.surname, `${d.name} ${d.surname}`, d.shortName].some((v) => norm(v).includes(query));
}
export function matchTeam(t, q) {
  const query = norm(q);
  return [t.teamId, t.teamName].some((v) => norm(v).includes(query));
}
export function matchCircuit(c, q) {
  const query = norm(q);
  return [c.circuitId, c.circuitName, c.city, c.country].some((v) => norm(v).includes(query));
}
