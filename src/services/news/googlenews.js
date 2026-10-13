import { newsCached } from "./cache.js";
import { fetchNewsHtml } from "./http.js";
import { parseRssItems, dedupeNews } from "./rss.js";

const SEARCH_RSS_URL = "https://news.google.com/rss/search";
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildUrl({ query, site, locale }) {
  const q = [query, site ? `site:${site}` : ""].filter(Boolean).join(" ").trim();
  const isEnglish = locale === "en";
  const params = new URLSearchParams({
    q,
    hl: isEnglish ? "en-US" : "id",
    gl: isEnglish ? "US" : "ID",
    ceid: isEnglish ? "US:en" : "ID:id",
  });
  return { q, url: `${SEARCH_RSS_URL}?${params.toString()}` };
}

function stripSourceSuffix(title, source) {
  if (!source) return title;
  const lower = title.toLowerCase();
  const name = source.toLowerCase();
  const suffixes = [` - ${name}`, ` | ${name}`];
  if (name.length >= 7) suffixes.push(` ${name}`);
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) return title.slice(0, -suffix.length).trim();
  }
  return title;
}

export async function searchGoogleNews({ query = "", site = "", locale = "id", limit = 10 } = {}) {
  const { q, url } = buildUrl({ query, site, locale });
  if (!q) return [];

  return newsCached(`gn:${locale}:${q}:${limit}`, CACHE_TTL_MS, async () => {
    const xml = await fetchNewsHtml(url, { timeout: 15000 });
    const items = parseRssItems(xml)
      .filter((item) => item.date)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return dedupeNews(
      items.map((item) => ({
        title: stripSourceSuffix(item.title, item.source),
        url: item.url,
        source: item.source || "Google News",
        image: item.image,
        date: item.date,
        snippet: item.snippet,
      }))
    ).slice(0, limit);
  });
}
