import { newsCached } from "./cache.js";
import { assertNewsUrl, cleanNewsTitle, extractArticleParagraphs, getMetaContent, joinArticleContent } from "./article.js";
import { fetchNewsHtml } from "./http.js";

const ARTICLE_TTL_MS = 30 * 60 * 1000;
const MAX_PARAGRAPHS = 8;

export const READABLE_HOSTS = [
  "antaranews.com",
  "tempo.co",
  "cnbcindonesia.com",
  "tribunnews.com",
  "bbc.com",
  "kompas.com",
  "detik.com",
  "cnn.com",
  "inews.id",
  "kompas.tv",
  "liputan6.com",
  "vivanews.com",
  "tirto.id",
  "suara.com",
  "merdeka.com",
  "jpnn.com",
  "okezone.com",
  "sindonews.com",
  "rmol.id",
  "republika.co.id",
];

export async function readNewsArticle(articleUrl) {
  const safeUrl = assertNewsUrl(articleUrl, READABLE_HOSTS, "situs berita yang didukung");

  return newsCached(`news:article:${safeUrl}`, ARTICLE_TTL_MS, async () => {
    const html = await fetchNewsHtml(safeUrl);
    const jsonLd = pickJsonLdArticle(html);

    const title = cleanNewsTitle(
      jsonLd?.headline || getMetaContent(html, ["og:title"]) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""
    );
    const image = pickImage(jsonLd?.image) || getMetaContent(html, ["og:image"]) || null;
    const time = jsonLd?.datePublished || getMetaContent(html, ["article:published_time", "pubdate", "date"]);
    const author = pickAuthor(jsonLd?.author) || getMetaContent(html, ["author"]);

    const jsonLdParagraphs = jsonLd?.articleBody ? bodyToParagraphs(jsonLd.articleBody) : [];
    const scrapedParagraphs = extractArticleParagraphs(html, { minLength: 40, max: MAX_PARAGRAPHS });
    const uniqueContent = [...new Set([...jsonLdParagraphs, ...scrapedParagraphs])].slice(0, MAX_PARAGRAPHS);

    return {
      title,
      url: safeUrl,
      image,
      time: formatArticleTime(time),
      author,
      content: joinArticleContent(uniqueContent) || "Isi artikel tidak dapat diekstrak. Silakan buka tautan aslinya.",
    };
  });
}

function pickJsonLdArticle(html) {
  const candidates = [];
  const blocks = String(html || "").matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

  for (const block of blocks) {
    try {
      collectJsonLd(JSON.parse(block[1].trim()), candidates);
    } catch (_) {}
  }

  return (
    candidates.find((node) => node.articleBody) ||
    candidates.find((node) => node.headline) ||
    null
  );
}

function collectJsonLd(node, out) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach((entry) => collectJsonLd(entry, out));
  if (typeof node !== "object") return;

  if (node["@graph"]) collectJsonLd(node["@graph"], out);

  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.some((type) => /Article|NewsArticle|Reportage|BlogPosting/i.test(String(type || "")))) {
    out.push(node);
  }
}

function pickImage(image) {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return pickImage(image[0]);
  return image.url || image.contentUrl || null;
}

function pickAuthor(author) {
  if (!author) return "";
  if (typeof author === "string") return author.trim();
  if (Array.isArray(author)) return author.map((entry) => pickAuthor(entry)).filter(Boolean).join(", ");
  return String(author.name || "").trim();
}

function bodyToParagraphs(body) {
  const sentences = String(body)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“(«])/);
  const paragraphs = [];
  let buffer = "";

  for (const sentence of sentences) {
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
    if (buffer.length > 320) {
      paragraphs.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());

  return paragraphs;
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
