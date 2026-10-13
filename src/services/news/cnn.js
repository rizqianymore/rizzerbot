import { randomUUID } from "node:crypto";
import { newsCached } from "./cache.js";
import {
  assertNewsUrl,
  cleanNewsTitle,
  extractArticleParagraphs,
  getMetaContent,
  joinArticleContent,
} from "./article.js";
import { fetchNewsHtml, fetchNewsJson } from "./http.js";

const CNN_SEARCH_BASE = "https://search.prod.di.api.cnn.io/search/query";
const CNN_HOSTS = ["cnn.com"];
const SEARCH_TTL_MS = 10 * 60 * 1000;
const LATEST_TTL_MS = 5 * 60 * 1000;
const ARTICLE_TTL_MS = 30 * 60 * 1000;

export async function searchCNNNews(query, options = {}) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return { total: 0, items: [] };

  const size = Math.min(Math.max(options.size || 5, 1), 20);
  const page = Math.max(options.page || 1, 1);
  const sort = options.sort || "relevance";
  const key = `cnn:search:${cleanQuery.toLowerCase()}:${size}:${page}:${sort}`;

  return newsCached(key, SEARCH_TTL_MS, () => requestCnnSearch(cleanQuery, { size, page, sort }));
}

export async function getCnnLatestNews(limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const key = `cnn:latest:${safeLimit}`;

  return newsCached(key, LATEST_TTL_MS, async () => {
    const { items } = await requestCnnSearch("", { size: Math.min(safeLimit * 3, 20), page: 1, sort: "date" });
    const articles = items.filter((item) => item.type !== "VideoObject").slice(0, safeLimit);
    return { total: articles.length, items: articles };
  });
}

export async function getCnnArticle(articleUrl) {
  const safeUrl = assertNewsUrl(articleUrl, CNN_HOSTS, "CNN (cnn.com)");

  return newsCached(`news:article:${safeUrl}`, ARTICLE_TTL_MS, async () => {
    const html = await fetchNewsHtml(safeUrl, { extraHeaders: { Referer: "https://edition.cnn.com/" } });

    const title = cleanNewsTitle(
      getMetaContent(html, ["og:title"]) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
      [" - CNN", " - CNN International", " - CNN Business"]
    );
    const image = getMetaContent(html, ["og:image"]) || null;
    const time = getMetaContent(html, ["article:published_time", "parsely-pub-date", "pubdate"]);
    const author = getMetaContent(html, ["author", "parsely-author", "byl"]).replace(/^By\s+/i, "");
    const content = joinArticleContent(
      extractArticleParagraphs(html, {
        pattern: /<p[^>]*class="paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
        minLength: 40,
        noise: ["cnn without borders", "watch:", "subscribe"],
        max: 8,
      })
    );

    return {
      title,
      url: safeUrl,
      image,
      time: formatArticleTime(time),
      author,
      content: content || "Isi artikel tidak dapat diekstrak. Baca langsung melalui tautan resmi CNN.",
    };
  });
}

async function requestCnnSearch(cleanQuery, { size, page, sort }) {
  const from = (page - 1) * size;
  const params = new URLSearchParams({
    q: cleanQuery,
    size: String(size),
    from: String(from),
    page: String(page),
    sort,
    tenant: "cnn-all-access",
    country: "ID",
    request_id: `stellar-search-${randomUUID()}`,
    site: "cnn",
    zaid: "",
  });

  const url = `${CNN_SEARCH_BASE}?${params.toString()}`;
  const data = await fetchNewsJson(url, {
    extraHeaders: {
      Accept: "*/*",
      Origin: "https://edition.cnn.com",
      Referer: "https://edition.cnn.com/",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
  });
  const total = Number(data?.meta?.of || data?.meta?.total || 0);
  const rawResults = Array.isArray(data?.result) ? data.result : [];

  return { total, items: rawResults.map(mapCnnItem) };
}

function mapCnnItem(item) {
  let date = null;
  if (item.lastModifiedDate) {
    const parsed = new Date(item.lastModifiedDate);
    if (!isNaN(parsed.getTime())) date = parsed;
  }

  return {
    title: cleanNewsTitle(item.headline),
    snippet: String(item.body || "").trim(),
    url: item.url || item.path || "",
    image: item.thumbnail || null,
    source: "CNN",
    type: item.type || "NewsArticle",
    date,
  };
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
