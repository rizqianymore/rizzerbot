import { newsCached } from "./cache.js";
import { assertNewsUrl, cleanNewsTitle, extractArticleParagraphs, getMetaContent, joinArticleContent } from "./article.js";
import { fetchNewsHtml } from "./http.js";

const INEWS_BASE = "https://www.inews.id";
const INEWS_HOSTS = ["inews.id"];
const SEARCH_TTL_MS = 10 * 60 * 1000;
const LATEST_TTL_MS = 5 * 60 * 1000;
const ARTICLE_TTL_MS = 30 * 60 * 1000;

const INEWS_HEADERS = { Referer: `${INEWS_BASE}/`, Origin: INEWS_BASE, "Sec-Fetch-Site": "same-origin" };

export async function searchInews(query, limit = 5) {
  const cleanQuery = String(query || "")
    .trim()
    .slice(0, 200);
  if (!cleanQuery) return [];

  const maxResults = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const queryWords = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  return newsCached(`inews:search:${cleanQuery.toLowerCase()}:${maxResults}`, SEARCH_TTL_MS, async () => {
    const url = `${INEWS_BASE}/find?q=${encodeURIComponent(cleanQuery)}`;
    const html = await fetchNewsHtml(url, { extraHeaders: INEWS_HEADERS, timeout: 15000 });
    return parseInewsCards(html, { queryWords, maxResults });
  });
}

export async function getLatestInews(limit = 5) {
  const maxResults = Math.min(Math.max(Number(limit) || 5, 1), 20);

  return newsCached(`inews:latest:${maxResults}`, LATEST_TTL_MS, async () => {
    const html = await fetchNewsHtml(`${INEWS_BASE}/`, { extraHeaders: INEWS_HEADERS, timeout: 15000 });
    return parseInewsCards(html, { queryWords: [], maxResults });
  });
}

export async function getInewsArticle(articleUrl) {
  const safeUrl = assertNewsUrl(articleUrl, INEWS_HOSTS, "iNews.id");

  return newsCached(`news:article:${safeUrl}`, ARTICLE_TTL_MS, async () => {
    const html = await fetchNewsHtml(safeUrl, { extraHeaders: INEWS_HEADERS, timeout: 15000 });

    const title = cleanNewsTitle(
      getMetaContent(html, ["og:title"]) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
      [" - iNews.id", " - iNews"]
    );
    const image = getMetaContent(html, ["og:image"]) || null;
    const time = getMetaContent(html, ["article:published_time", "pubdate"]) || extractJsonLdDate(html);
    const author = getMetaContent(html, ["author"]) || extractJsonLdAuthor(html);
    const content = joinArticleContent(
      extractArticleParagraphs(html, {
        minLength: 30,
        noise: ["iNews.id", "redaksi", "editor iNews"],
        max: 8,
      })
    );

    return {
      title,
      url: safeUrl,
      image,
      time: formatArticleTime(time),
      author,
      content: content || "Isi artikel tidak dapat diekstrak. Baca langsung melalui tautan resmi iNews.id.",
    };
  });
}

function parseInewsCards(html, { queryWords, maxResults }) {
  const blocks = [...String(html || "").matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)];
  const results = [];

  for (const block of blocks) {
    const raw = block[1];
    const linkMatch = raw.match(/href="(https:\/\/www\.inews\.id\/[^"]+)"/i);
    const titleMatch =
      raw.match(/<h3[^>]*class="cardTitle"[^>]*>([\s\S]*?)<\/h3>/i) ||
      raw.match(/title="([^"]+)"/i) ||
      raw.match(/alt="([^"]+)"/i);

    if (!linkMatch || !titleMatch) continue;

    const articleUrl = linkMatch[1];
    if (articleUrl.includes("/playlists/") || results.some((item) => item.url === articleUrl)) continue;

    const title = cleanNewsTitle(titleMatch[1], [" - iNews.id"]);
    const titleLower = title.toLowerCase();
    const isRelevant = queryWords.length === 0 || queryWords.some((word) => titleLower.includes(word));
    if (!isRelevant) continue;

    results.push({
      title,
      url: articleUrl,
      image: raw.match(/src="(https:\/\/[^"]+)"/i)?.[1] || null,
      source: "iNews.id",
      channel: raw.match(/<div class="kanal">([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "",
      time: raw.match(/<div class="postTime">([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "",
      snippet: "",
    });

    if (results.length >= maxResults) break;
  }

  return results;
}

function extractJsonLdDate(html) {
  return html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || "";
}

function extractJsonLdAuthor(html) {
  const match =
    html.match(/"author"\s*:\s*\[?\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/i) || html.match(/"author"\s*:\s*"([^"]+)"/i);
  return match?.[1] || "";
}

function formatArticleTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return String(value).trim();
  return parsed.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
