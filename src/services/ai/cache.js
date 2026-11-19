import crypto from "node:crypto";

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const store = new Map();

function keyOf(prompt, options = {}) {
  const h = JSON.stringify(options.history || []);
  return crypto
    .createHash("sha1")
    .update(`${options.prefer || "auto"}|${prompt}|${h ? h.slice(0, 200) : ""}`)
    .digest("hex");
}

export function cacheGet(prompt, options = {}) {
  const k = keyOf(prompt, options);
  const hit = store.get(k);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(k);
    return null;
  }
  return hit.value;
}

export function cacheSet(prompt, options = {}, value = {}, ttlMs = DEFAULT_TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(keyOf(prompt, options), { value, expires: Date.now() + ttlMs });
}

export function cacheClear() {
  const n = store.size;
  store.clear();
  return n;
}

export function cacheStats() {
  const now = Date.now();
  let live = 0;
  for (const v of store.values()) if (v.expires > now) live++;
  return { size: store.size, live };
}

export default { cacheGet, cacheSet, cacheClear, cacheStats };
