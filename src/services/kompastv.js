import axios from "axios";
import { getRandomDevice, buildScraperHeaders } from "@/src/services/scrape.js";

const KOMPAS_BASE = "https://www.kompas.tv";


/**
 * Mengambil daftar berita terkini dari Kompas TV (halaman /news atau kategori tertentu)
 * @param {string} category - "news", "nasional", "regional", "internasional", "ekonomi", "olahraga"
 * @param {number} limit - Jumlah berita yang diambil (default: 5)
 */
export async function getLatestKompasNews(category = "news", limit = 5) {
  const safeCategory = (category || "news").toLowerCase().trim();
  const url = `${KOMPAS_BASE}/${safeCategory === "news" ? "news" : safeCategory}`;

  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: KOMPAS_BASE,
  });

  const res = await axios.get(url, {
    headers,
    timeout: 15000,
  });

  const html = res.data;
  const blocks = html.split("<div class=\"opininews2\">").slice(1);
  const articles = [];

  for (const block of blocks) {
    if (articles.length >= limit) break;

    const urlMatch = block.match(/href="([^"]+)"/i);
    const imgMatch = block.match(/src="([^"]+)"/i);
    const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const timeMatch = block.match(/<div class="secsmalltime2">([\s\S]*?)<\/div>/i);

    if (urlMatch && titleMatch) {
      const rawTitle = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      const cleanUrl = urlMatch[1].trim();

      // Hindari template JS dan duplikasi
      if (rawTitle && !rawTitle.includes("row.title") && !articles.some((a) => a.url === cleanUrl)) {
        articles.push({
          title: rawTitle,
          url: cleanUrl,
          image: imgMatch ? imgMatch[1].trim() : null,
          time: timeMatch ? timeMatch[1].replace(/<[^>]+>/g, "").trim() : "Baru saja",
        });
      }
    }
  }

  return articles;
}

/**
 * Mencari berita di Kompas TV berdasarkan kata kunci (query)
 * Menggunakan headless browser untuk merender Google CSE di Kompas TV
 * @param {string} query - Kata kunci pencarian (misal: "polres", "gempa", dll)
 * @param {number} limit - Jumlah hasil pencarian (default: 5)
 */
export async function searchKompasNews(query, limit = 5) {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new Error("Kata kunci pencarian tidak boleh kosong.");

  // 1. Coba pencarian cepat dari kategori portal Kompas TV langsung
  const localResults = await searchKompasNewsFallback(cleanQuery, limit);
  if (localResults && localResults.length > 0) return localResults;

  // 2. Pencarian berbasis Google News RSS untuk topik yang lebih luas (100% cepat & tanpa browser)
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:kompas.tv ${cleanQuery}`)}&hl=id&gl=ID&ceid=ID:id`;
    const res = await axios.get(rssUrl, { timeout: 8000 });
    const items = [...res.data.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
    const results = [];

    for (const it of items) {
      let title = it[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
      title = title.replace(/\s*-\s*Kompas\.tv$/i, "").trim();
      const link = it[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = it[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "Baru saja";
      if (title && link) {
        results.push({
          title,
          url: link,
          time: pubDate,
          image: null,
          snippet: "",
        });
      }
    }

    if (results.length > 0) return results;
  } catch (_) {}

  throw new Error(`Pencarian untuk "${cleanQuery}" tidak menemukan berita yang cocok di Kompas TV.`);
}

/**
 * Pencarian cepat berbasis HTTP tanpa browser di seluruh kanal Kompas TV
 */
async function searchKompasNewsFallback(query, limit = 5) {
  const categories = ["news", "nasional", "regional", "internasional", "ekonomi", "olahraga"];
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const matched = [];

  for (const cat of categories) {
    if (matched.length >= limit) break;
    try {
      const items = await getLatestKompasNews(cat, 12);
      for (const it of items) {
        const titleLower = it.title.toLowerCase();
        const isMatch = queryWords.length === 0 || queryWords.some((w) => titleLower.includes(w));
        if (isMatch && !matched.some((m) => m.url === it.url)) {
          matched.push(it);
          if (matched.length >= limit) break;
        }
      }
    } catch (_) {}
  }

  return matched;
}

/**
 * Membaca detail isi berita Kompas TV berdasarkan tautan artikel
 * @param {string} articleUrl - Tautan lengkap artikel berita Kompas TV
 */
export async function getKompasArticleDetail(articleUrl) {
  if (!articleUrl.startsWith(KOMPAS_BASE)) {
    throw new Error("Tautan harus berasal dari situs kompas.tv!");
  }

  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: KOMPAS_BASE,
  });

  const res = await axios.get(articleUrl, {
    headers,
    timeout: 15000,
  });

  const html = res.data;
  const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "Berita Kompas TV";
  const image = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || null;

  const dateMatch = html.match(/<span class="time-news">([\s\S]*?)<\/span>/i);
  const time = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, "").replace(/^Kompas\.tv\s*-\s*/i, "").trim() : "";

  const authorMatch = html.match(/<div class="author-text">([\s\S]*?)<\/div>/i);
  const author = authorMatch ? authorMatch[1].replace(/\s+/g, " ").replace(/<[^>]+>/g, "").trim() : "";

  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(
      (p) =>
        p.length > 25 &&
        !p.toLowerCase().includes("baca juga") &&
        !p.toLowerCase().includes("kompas.tv -") &&
        !p.toLowerCase().includes("copyright")
    );

  const content = paragraphs.slice(0, 4).join("\n\n");

  return {
    title,
    url: articleUrl,
    image,
    time,
    author,
    content: content || "Rincian lengkap dapat dibaca langsung melalui situs resmi Kompas TV.",
  };
}
