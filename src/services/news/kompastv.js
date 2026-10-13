import { newsCached } from "./cache.js";
import { searchGoogleNews } from "./googlenews.js";
import { assertNewsUrl, cleanNewsTitle, extractArticleParagraphs, getMetaContent, joinArticleContent } from "./article.js";
import { fetchNewsHtml } from "./http.js";

const KOMPAS_BASE = "https://www.kompas.tv";
const KOMPAS_HOSTS = ["kompas.tv"];
const SEARCH_CATEGORIES = ["news", "nasional", "regional", "internasional", "ekonomi", "olahraga"];
const LATEST_TTL_MS = 5 * 60 * 1000;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const ARTICLE_TTL_MS = 30 * 60 * 1000;

const KOMPAS_HEADERS = { Referer: KOMPAS_BASE };

export async function getLatestKompasNews(category = "news", limit = 5) {
  const safeCategory = (category || "news").toLowerCase().trim();
  const maxResults = Math.min(Math.max(Number(limit) || 5, 1), 20);

  return newsCached(`kompas:latest:${safeCategory}:${maxResults}`, LATEST_TTL_MS, async () => {
    const html = await fetchNewsHtml(`${KOMPAS_BASE}/${safeCategory}`, {
      extraHeaders: KOMPAS_HEADERS,
      timeout: 15000,
    });
    return parseKompasCards(html, maxResults);
  });
}

export async function searchKompasNews(query, limit = 5) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) throw new Error("Kata kunci pencarian tidak boleh kosong.");

  const maxResults = Math.min(Math.max(Number(limit) || 5, 1), 20);

  return newsCached(`kompas:search:${cleanQuery.toLowerCase()}:${maxResults}`, SEARCH_TTL_MS, async () => {
    const localResults = await searchKompasLocal(cleanQuery, maxResults);
    if (localResults.length > 0) return localResults;

    try {
      const results = await searchGoogleNews({ query: cleanQuery, site: "kompas.tv", limit: maxResults });
      if (results.length > 0) return results;
    } catch (_) {}

    throw new Error(`Pencarian untuk "${cleanQuery}" tidak menemukan berita yang cocok di Kompas TV.`);
  });
}

export async function getKompasArticleDetail(articleUrl) {
  const safeUrl = assertNewsUrl(articleUrl, KOMPAS_HOSTS, "Kompas TV (kompas.tv)");

  return newsCached(`news:article:${safeUrl}`, ARTICLE_TTL_MS, async () => {
    const html = await fetchNewsHtml(safeUrl, { extraHeaders: KOMPAS_HEADERS, timeout: 15000 });

    const title = cleanNewsTitle(
      getMetaContent(html, ["og:title"]) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
      [" - Kompas.tv", " - Kompas TV"]
    );
    const image = getMetaContent(html, ["og:image"]) || null;
    const time =
      html.match(/<span class="time-news">([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
      getMetaContent(html, ["article:published_time", "pubdate"]);
    const author =
      html.match(/<div class="author-text">([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ||
      getMetaContent(html, ["author"]);
    const content = joinArticleContent(
      extractArticleParagraphs(html, { minLength: 25, noise: ["tonton juga", "nonton streaming"], max: 8 })
    );

    return {
      title,
      url: safeUrl,
      image,
      time: time.replace(/^Kompas\.tv\s*-\s*/i, "").trim(),
      author: author.replace(/^By\s+/i, ""),
      content: content || "Rincian lengkap dapat dibaca langsung melalui situs resmi Kompas TV.",
    };
  });
}

function parseKompasCards(html, maxResults) {
  const blocks = String(html || "").split('<div class="opininews2">').slice(1);
  const articles = [];

  for (const block of blocks) {
    if (articles.length >= maxResults) break;

    const url = block.match(/href="([^"]+)"/i)?.[1]?.trim();
    const image = block.match(/src="([^"]+)"/i)?.[1]?.trim();
    const rawTitle = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const time = block.match(/<div class="secsmalltime2">([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();

    if (!url || !rawTitle || rawTitle.includes("row.title")) continue;
    if (articles.some((item) => item.url === url)) continue;

    articles.push({
      title: cleanNewsTitle(rawTitle, [" | SAPA SIANG"]),
      url,
      image: image || null,
      source: "Kompas TV",
      time: time || "Baru saja",
      snippet: "",
    });
  }

  return articles;
}

async function searchKompasLocal(query, limit) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2);

  const settled = await Promise.allSettled(
    SEARCH_CATEGORIES.map((category) => getLatestKompasNews(category, 12))
  );

  const matched = [];
  for (const result of settled) {
    if (result.status !== "fulfilled" || matched.length >= limit) continue;
    for (const item of result.value) {
      const titleLower = item.title.toLowerCase();
      const isMatch = words.length === 0 || words.some((word) => titleLower.includes(word));
      if (isMatch && !matched.some((entry) => entry.url === item.url)) matched.push(item);
      if (matched.length >= limit) break;
    }
  }

  return matched;
}
