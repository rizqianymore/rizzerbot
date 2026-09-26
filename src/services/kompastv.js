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

  const { default: puppeteer } = await import("puppeteer");
  const device = getRandomDevice("desktop");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(device.userAgent);
  if (device.viewport) {
    await page.setViewport(device.viewport);
  }

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const targetUrl = `${KOMPAS_BASE}/search?q=${encodeURIComponent(cleanQuery)}`;

  try {
    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Google CSE input handling if needed
    const cseInputSelector = "input.gsc-input, input#gsc-i-id1, input[name='search']";
    const hasInput = await page.$(cseInputSelector);
    if (hasInput) {
      await page.focus(cseInputSelector);
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up("Control");
      await page.keyboard.press("Backspace");
      await page.type(cseInputSelector, cleanQuery, { delay: 30 });
      await page.keyboard.press("Enter");
    }

    // Menunggu Google CSE selesai merender hasil pencarian
    await page.waitForSelector(".gsc-webResult.gsc-result, a.gs-title", {
      timeout: 15000,
    });

    // Beri jeda sejenak untuk memastikan hasil selesai di-render
    await new Promise((r) => setTimeout(r, 1000));

    const queryWords = cleanQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const rawResults = await page.evaluate((max) => {
      const list = [];
      const nodes = document.querySelectorAll(".gsc-webResult.gsc-result");
      for (const n of nodes) {
        if (list.length >= max * 3) break;
        const titleEl = n.querySelector("a.gs-title");
        const snippetEl = n.querySelector(".gs-snippet");
        const imgEl = n.querySelector(".gs-image img") || n.querySelector("img");

        if (titleEl && titleEl.href && !titleEl.href.includes("google.com")) {
          const title = titleEl.innerText.trim();
          const url = titleEl.href;
          const snippet = snippetEl ? snippetEl.innerText.trim() : "";
          const image = imgEl ? (imgEl.src || imgEl.getAttribute("src")) : null;

          if (title && url) {
            list.push({ title, url, snippet, image });
          }
        }
      }
      return list;
    }, limit);

    // Filter hasil agar benar-benar relevan dengan topik yang dicari
    // Untuk query spesifik seperti 'pt kai', prioritaskan artikel yang mengandung kata kunci tersebut
    const filtered = rawResults.filter((item) => {
      if (queryWords.length === 0) return true;
      const combinedText = `${item.title} ${item.snippet}`.toLowerCase();
      // Harus mengandung setidaknya 1 kata kunci utama
      return queryWords.some((w) => combinedText.includes(w));
    });

    // Urutkan berdasarkan skor kecocokan tertinggi
    filtered.sort((a, b) => {
      const aText = `${a.title} ${a.snippet}`.toLowerCase();
      const bText = `${b.title} ${b.snippet}`.toLowerCase();
      const aScore = queryWords.reduce((acc, w) => acc + (aText.includes(w) ? 1 : 0), 0) + (aText.includes(cleanQuery.toLowerCase()) ? 2 : 0);
      const bScore = queryWords.reduce((acc, w) => acc + (bText.includes(w) ? 1 : 0), 0) + (bText.includes(cleanQuery.toLowerCase()) ? 2 : 0);
      return bScore - aScore;
    });

    const finalResults = filtered.length > 0 ? filtered.slice(0, limit) : [];
    if (finalResults.length > 0) return finalResults;

    throw new Error("Hasil kosong");
  } catch (err) {
    const fallbackList = await searchKompasNewsFallback(cleanQuery, limit);
    if (fallbackList.length > 0) return fallbackList;
    throw new Error(`Pencarian untuk "${cleanQuery}" tidak menemukan berita yang cocok di Kompas TV.`);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Fallback jika rendering browser Google CSE mengalami hambatan
 */
async function searchKompasNewsFallback(query, limit = 5) {
  const categories = ["news", "nasional", "regional", "internasional", "ekonomi", "olahraga"];
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const matched = [];

  for (const cat of categories) {
    if (matched.length >= limit) break;
    try {
      const items = await getLatestKompasNews(cat, 10);
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
