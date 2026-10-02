// src/services/steam.js — Steam Store promo (https://store.steampowered.com).
// Endpoint publik tanpa key/login: /api/featuredcategories (specials, top sellers,
// new releases) + capsule image per appid.
// Rate limit Steam ~300 req/5 mnt -> cache 30 menit. Anti-bug: timeout,
// validasi magic-bytes + ukuran minimum, selalu fallback ke teks.

const STEAM_BASE = "https://store.steampowered.com";
const FETCH_TIMEOUT_MS = 15000;
const MIN_BYTES = 8 * 1024;

const cache = new Map(); // key -> { data, expires }
function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}
function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  if (cache.size > 50) cache.delete(cache.keys().next().value);
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "rizzerbot/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Steam HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function isRealImageBuffer(buf) {
  if (!buf || buf.length < MIN_BYTES) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  return isJpeg || isPng || isWebp || isGif;
}

async function fetchCategories() {
  const hit = cacheGet("featured");
  if (hit) return hit;
  const res = await fetchWithTimeout(`${STEAM_BASE}/api/featuredcategories/?cc=ID&l=indonesian`);
  const data = await res.json();
  if (!data || typeof data !== "object") throw new Error("Respon Steam tidak valid.");
  cacheSet("featured", data, 30 * 60 * 1000);
  return data;
}

const KINDS = {
  promo: { key: "specials", title: "PROMO STEAM" },
  sale: { key: "specials", title: "PROMO STEAM" },
  diskon: { key: "specials", title: "PROMO STEAM" },
  top: { key: "top_sellers", title: "TOP SELLER STEAM" },
  terlaris: { key: "top_sellers", title: "TOP SELLER STEAM" },
  new: { key: "new_releases", title: "RILIS BARU STEAM" },
  baru: { key: "new_releases", title: "RILIS BARU STEAM" },
  rilis: { key: "new_releases", title: "RILIS BARU STEAM" },
};

export function parseSteamKind(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return KINDS.promo;
  return KINDS[s] || null;
}

export function formatIDR(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "-";
  return "Rp" + Math.round(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Ambil daftar deal ternormalisasi: { id, name, discount,was, now, image }. */
export async function getSteamDeals(kindKey = "specials", limit = 8) {
  const data = await fetchCategories();
  const items = data?.[kindKey]?.items || [];
  return items.slice(0, limit).map((a) => ({
    id: a?.id,
    name: String(a?.name || "Unknown"),
    discount: Number(a?.discount_percent) || 0,
    was: a?.original_price ?? null,
    now: a?.final_price ?? null,
    image: a?.large_capsule_image || a?.small_capsule_image || "",
  })).filter((d) => d.id);
}

export function fmtSteamDeals(title, deals) {
  const lines = [`🎮 *${title}* (IDR)`];
  deals.forEach((d, i) => {
    const disc = d.discount > 0 ? ` *-${d.discount}%*` : "";
    const price = d.now != null ? ` ${formatIDR(d.now)}` : "";
    const was = d.discount > 0 && d.was != null ? ` ~${formatIDR(d.was)}~` : "";
    lines.push(`${i + 1}. *${d.name}*${disc}\n    ${price}${was}\n    https://store.steampowered.com/app/${d.id}/`);
  });
  return lines.join("\n");
}

/** Download capsule art terdepan yang valid. Return Buffer atau null. */
export async function getSteamDealImage(deals) {
  for (const d of deals || []) {
    try {
      if (!d?.image || typeof d.image !== "string" || !d.image.startsWith("https://")) continue;
      const res = await fetchWithTimeout(d.image);
      const ct = String(res.headers.get("content-type") || "");
      if (!ct.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (isRealImageBuffer(buf)) return buf;
    } catch (_) {}
  }
  return null;
}
