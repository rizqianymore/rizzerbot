import { newsCached } from "./cache.js";
import { fetchNewsHtml } from "./http.js";

const FEED_TTL_MS = 5 * 60 * 1000;

export const RSS_SOURCES = [
  { key: "antara", name: "Antara", url: "https://www.antaranews.com/rss/terkini.xml" },
  { key: "tempo", name: "Tempo", url: "https://rss.tempo.co/nasional" },
  { key: "cnbc", name: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/rss" },
  { key: "tribun", name: "Tribunnews", url: "https://www.tribunnews.com/rss" },
  { key: "cnnindonesia", name: "CNN Indonesia", url: "https://www.cnnindonesia.com/rss" },
  { key: "bbc", name: "BBC News Indonesia", url: "https://feeds.bbci.co.uk/indonesia/rss.xml" },
];

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  copy: "©",
  reg: "®",
  deg: "°",
};

export function decodeNewsEntities(text = "") {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => safeCodePoint(parseInt(num, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch (_) {
    return "";
  }
}

export function stripHtmlTags(text = "") {
  let output = String(text);
  for (let pass = 0; pass < 2; pass++) {
    output = decodeNewsEntities(output.replace(/<[^>]+>/g, " "));
  }
  return output.replace(/\s+/g, " ").trim();
}

function grab(block, regex) {
  const match = block.match(regex);
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

export function parseRssItems(xml, fallbackSource = "") {
  const blocks = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const items = [];

  for (const block of blocks) {
    const title = stripHtmlTags(grab(block, /<title>([\s\S]*?)<\/title>/i));
    const url = grab(block, /<link>([\s\S]*?)<\/link>/i);
    if (!title || !/^https?:\/\//i.test(url)) continue;

    const rawDate = grab(block, /<pubDate>([\s\S]*?)<\/pubDate>/i);
    let date = null;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) date = parsed;
    }

    items.push({
      title,
      url,
      date,
      source: stripHtmlTags(grab(block, /<source[^>]*>([\s\S]*?)<\/source>/i)) || fallbackSource,
      image: grab(block, /<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i) || null,
      snippet: stripHtmlTags(grab(block, /<description>([\s\S]*?)<\/description>/i)).slice(0, 220),
    });
  }

  return items;
}

export async function fetchRssSource(source) {
  return newsCached(`rss:${source.key}`, FEED_TTL_MS, async () => {
    const xml = await fetchNewsHtml(source.url, { timeout: 15000 });
    return parseRssItems(xml, source.name);
  });
}

async function fetchAllSources() {
  const settled = await Promise.allSettled(RSS_SOURCES.map((source) => fetchRssSource(source)));
  const merged = [];
  for (const result of settled) {
    if (result.status === "fulfilled") merged.push(...result.value);
  }
  return sortNewsItems(merged);
}

export function sortNewsItems(items) {
  return items.slice().sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
}

export async function getRssLatest({ limit = 8, excludeUrls = [] } = {}) {
  const items = await fetchAllSources();
  return dedupeNews(items.filter((item) => !excludeUrls.includes(item.url))).slice(0, limit);
}

export async function searchRssFeed({ query, limit = 8 } = {}) {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (!words.length) return [];

  const items = await fetchAllSources();
  const matched = items
    .map((item) => {
      const haystack = `${item.title} ${item.snippet}`.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.date?.getTime() || 0) - (a.item.date?.getTime() || 0));

  return dedupeNews(matched.map((entry) => entry.item)).slice(0, limit);
}

export function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
