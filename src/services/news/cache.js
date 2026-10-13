const store = new Map();
const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function newsCacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.data;
}

export function newsCacheSet(key, data, ttlMs = DEFAULT_TTL_MS) {
  if (data === undefined || data === null) return data;
  store.set(key, { data, expires: Date.now() + ttlMs });
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
  return data;
}

export async function newsCached(key, ttlMs, loader) {
  const hit = newsCacheGet(key);
  if (hit !== undefined) return hit;
  return newsCacheSet(key, await loader(), ttlMs);
}

export function clearNewsCache() {
  store.clear();
}
