export function createTtlCache({ ttlMs = 10 * 60 * 1000, max = 200 } = {}) {
  const map = new Map();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return undefined;
      if (Date.now() > e.exp) {
        map.delete(key);
        return undefined;
      }
      map.delete(key);
      map.set(key, e);
      return e.val;
    },
    set(key, val) {
      if (map.has(key)) map.delete(key);
      else if (map.size >= max) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
      map.set(key, { val, exp: Date.now() + ttlMs });
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}
