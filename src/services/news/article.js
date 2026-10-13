import { decodeNewsEntities, stripHtmlTags } from "./rss.js";

const DEFAULT_NOISE = [
  "baca juga",
  "baca juga:",
  "copyright",
  "editor :",
  "simak breaking news",
  "share this article",
  "read more",
  "related articles",
  "scan this qr",
  "download app",
  "download kompastv",
  "adsbygoogle",
  "sumber : kompas tv",
  "kompastv shorts",
  "gabung ke channel whatsapp",
  "berita lainnya",
  "© 20",
];

const PREFIX_NOISE = ["kompas.tv -"];

const JS_SIGNATURES = ["function(", "function (", "var ", "};", "googletag", "window.", "document.", "=> {"];

export function stripNoiseBlocks(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

export function getMetaContent(html, names = []) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]*(?:property|name)="${name}"[^>]*content="([^"]*)"`, "i"),
      new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${name}"`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) return decodeNewsEntities(match[1].trim());
    }
  }
  return "";
}

export function extractArticleParagraphs(html, options = {}) {
  const {
    pattern = /<p[^>]*>([\s\S]*?)<\/p>/gi,
    minLength = 25,
    noise = [],
    max = 6,
  } = options;
  const blocked = DEFAULT_NOISE.concat(noise).map((entry) => entry.toLowerCase());
  const paragraphs = [];

  for (const match of stripNoiseBlocks(html).matchAll(pattern)) {
    const text = stripHtmlTags(match[1]);
    if (text.length < minLength || text.length > 2500) continue;
    const lower = text.toLowerCase();
    if (blocked.some((entry) => lower.includes(entry))) continue;
    if (text.length < 300 && PREFIX_NOISE.some((entry) => lower.startsWith(entry))) continue;
    if (JS_SIGNATURES.some((signature) => text.includes(signature))) continue;
    paragraphs.push(text);
    if (paragraphs.length >= max) break;
  }

  return paragraphs;
}

export function assertNewsUrl(url, hosts, label) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch (_) {
    throw new Error("URL artikel tidak valid!");
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = hosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
  if (!allowed) throw new Error(`Tautan harus berasal dari ${label}!`);
  return parsed.toString();
}

export function cleanNewsTitle(title, suffixes = []) {
  let value = stripHtmlTags(title || "");
  for (const suffix of suffixes) {
    if (value.toLowerCase().endsWith(suffix.toLowerCase())) {
      value = value.slice(0, -suffix.length).trim();
    }
  }
  value = value.replace(/\s*[|–]\s*([^|–]{1,25})$/, (match, tag) => (isTrailingTag(tag.trim()) ? "" : match)).trim();
  return value || "Tanpa Judul";
}

function isTrailingTag(tag) {
  if (!tag || tag.length > 25) return false;
  if (/^[A-Z0-9 .,'&:()!-]+$/.test(tag)) return true;
  return /^(CNN|Kompas|Tempo|Antara|Tribun|CNBC|BBC|Reuters|AP)\b/i.test(tag);
}

export function joinArticleContent(paragraphs) {
  return paragraphs.join("\n\n").trim();
}
