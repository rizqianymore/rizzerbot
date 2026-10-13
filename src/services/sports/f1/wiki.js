const WIKI_TIMEOUT_MS = 12000;
const WIKI_MIN_BYTES = 8 * 1024;
const wikiBufCache = new Map();

function wikiCacheGet(title) {
  const hit = wikiBufCache.get(title);
  if (hit && hit.expires > Date.now()) return hit.data;
  wikiBufCache.delete(title);
  return null;
}
function wikiCacheSet(title, data) {
  wikiBufCache.set(title, { data, expires: Date.now() + 12 * 60 * 60 * 1000 });
  if (wikiBufCache.size > 100) wikiBufCache.delete(wikiBufCache.keys().next().value);
}

function extractWikiTitle(wikiUrl) {
  try {
    const u = new URL(String(wikiUrl || ""));
    if (!/\.wikipedia\.org$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/wiki\/(.+)/);
    if (!m) return null;
    const title = decodeURIComponent(m[1]).trim();
    if (!title || title.length > 200) return null;
    return title;
  } catch (_) {
    return null;
  }
}

function isRealImageBuffer(buf) {
  if (!buf || buf.length < WIKI_MIN_BYTES) return false;
  const b = buf;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp =
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50;
  const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
  return isJpeg || isPng || isWebp || isGif;
}

async function fetchWithTimeout(url, { timeoutMs = WIKI_TIMEOUT_MS, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "rizzerbot/1.0", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWikiThumbnail(wikiUrl, thumbSize = 1000) {
  const title = extractWikiTitle(wikiUrl);
  if (!title) return null;
  const cached = wikiCacheGet(title);
  if (cached) return cached;
  try {
    const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&formatversion=2&pithumbsize=${thumbSize}`;
    const res = await fetchWithTimeout(api);
    const j = await res.json();
    const page = j?.query?.pages?.[0];
    const src = page?.thumbnail?.source;
    if (src && typeof src === "string" && src.startsWith("https://")) {
      const buf = await downloadValidImage(src);
      if (buf) {
        wikiCacheSet(title, buf);
        return buf;
      }
    }

    const logoBuf = await getWikiLogoFallback(title, thumbSize);
    if (logoBuf) {
      wikiCacheSet(title, logoBuf);
      return logoBuf;
    }
    return null;
  } catch (_) {
    return null;
  }
}

const LOGO_DENY = [
  "commons-logo",
  "wikimedia",
  "wikipedia",
  "edit-",
  "icon",
  "button",
  "symbol",
  "arrow",
  "increase",
  "decrease",
  "check-",
  "red x",
  "green tick",
];
async function getWikiLogoFallback(title, thumbSize) {
  try {
    const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&format=json&formatversion=2&imlimit=100`;
    const res = await fetchWithTimeout(api);
    const j = await res.json();
    const imgs = j?.query?.pages?.[0]?.images || [];
    const cands = imgs
      .map((i) => String(i?.title || ""))
      .filter((t) => t.toLowerCase().startsWith("file:") && t.toLowerCase().includes("logo"))
      .filter((t) => !LOGO_DENY.some((d) => t.toLowerCase().includes(d)))
      .sort((a, b) => {
        const rank = (t) => (/\.svg$/i.test(t) ? 0 : /\.(png|jpg|jpeg)$/i.test(t) ? 1 : 2);
        return rank(a) - rank(b);
      });
    for (const fileTitle of cands.slice(0, 3)) {
      const name = fileTitle.replace(/^file:/i, "");
      for (const host of ["commons.wikimedia.org", "en.wikipedia.org"]) {
        const url = `https://${host}/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${thumbSize}`;
        const buf = await downloadValidImage(url).catch(() => null);
        if (buf) return buf;
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function downloadValidImage(url) {
  const img = await fetchWithTimeout(url);
  const ct = String(img.headers.get("content-type") || "");
  if (!ct.startsWith("image/")) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  if (!isRealImageBuffer(buf)) return null;
  return buf;
}
