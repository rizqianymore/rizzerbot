import axios from "axios";
import { getRandomDevice, buildScraperHeaders } from "@/src/services/scrape.js";

const KOMPAS_BASE = "https://www.kompas.tv";

let puppeteerBrowser = null;

async function getBrowserInstance() {
  if (puppeteerBrowser?.connected) return puppeteerBrowser;
  const { default: puppeteer } = await import("puppeteer");
  puppeteerBrowser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });
  return puppeteerBrowser;
}

/**
 * Mengambil daftar berita terkini dari Kompas TV (halaman /news atau kategori tertentu)
 * @param {string} category - "news", "nasional", "regional", "internasional", "ekonomi", "olahraga"
 * @param {number} limit - Jumlah berita yang diambil (default: 5)
 */
export async function getLatestKompasNews(category = "news", limit = 5) {
  const safeCategory = (category || "news").toLowerCase().trim();
  const url = `${KOMPAS_BASE}/${safeCategory === "news" ? "news" : safeCategory}`;

  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: KOMPAS_BASE,
    },
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
  if (!query) throw new Error("Kata kunci pencarian tidak boleh kosong.");

  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });

  const page = await browser.newPage();
  const targetUrl = `${KOMPAS_BASE}/search?q=${encodeURIComponent(query)}`;

  try {
    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 35000,
    });

    // Menunggu Google CSE selesai merender hasil pencarian
    await page.waitForSelector(".gsc-webResult, .gsc-result, a.gs-title", {
      timeout: 15000,
    });

    const results = await page.evaluate((max) => {
      const list = [];
      const nodes = document.querySelectorAll(".gsc-webResult.gsc-result");
      for (const n of nodes) {
        if (list.length >= max) break;
        const titleEl = n.querySelector("a.gs-title");
        const snippetEl = n.querySelector(".gs-snippet");
        const imgEl = n.querySelector(".gs-image img");

        if (titleEl && titleEl.href && !titleEl.href.includes("google.com")) {
          const title = titleEl.innerText.trim();
          const url = titleEl.href;
          const snippet = snippetEl ? snippetEl.innerText.trim() : "";
          const image = imgEl ? imgEl.src : null;

          if (title && url) {
            list.push({ title, url, snippet, image });
          }
        }
      }
      return list;
    }, limit);

    return results;
  } catch (err) {
    console.error("[Kompas Search Error]", err.message);
    const fallbackList = await searchKompasNewsFallback(query, limit);
    if (fallbackList.length > 0) return fallbackList;
    throw new Error(`Pencarian untuk "${query}" tidak menemukan hasil.`);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Fallback jika rendering browser Google CSE mengalami hambatan
 */
async function searchKompasNewsFallback(query, limit = 5) {
  const categories = ["news", "nasional", "regional", "internasional", "ekonomi", "olahraga"];
  const qLower = query.toLowerCase();
  const matched = [];

  for (const cat of categories) {
    if (matched.length >= limit) break;
    try {
      const items = await getLatestKompasNews(cat, 10);
      for (const it of items) {
        if (it.title.toLowerCase().includes(qLower) && !matched.some((m) => m.url === it.url)) {
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

  const res = await axios.get(articleUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: KOMPAS_BASE,
    },
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
