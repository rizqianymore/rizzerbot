const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 500;
const store = new Map();

export function normalizePrompt(prompt) {
  if (!prompt || typeof prompt !== "string") return "";
  return prompt
    .toLowerCase()
    .replace(/[?!.,;:_~`'"()\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function keyOf(prompt, options = {}) {
  const norm = normalizePrompt(prompt);
  const p = options.prefer || "auto";
  const h = options.history ? (Array.isArray(options.history) ? options.history.length : 0) : 0;
  return `${p}|${h}|${fnv1a(norm)}`;
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
