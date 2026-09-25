import { getRandomDevice, buildScraperHeaders } from "@/src/services/scrape.js";

const INEWS_SEARCH_URL = "https://www.inews.id/find";

/**
 * Mencari berita di iNews.id berdasarkan topik / kata kunci dengan filter relevansi ketat
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Promise<Array<{title: string, url: string, image: string|null, category: string, time: string}>>}
 */
export async function searchInews(query, limit = 5) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: "https://www.inews.id/",
    Origin: "https://www.inews.id",
    "Sec-Fetch-Site": "same-origin",
  });

  const url = `${INEWS_SEARCH_URL}?q=${encodeURIComponent(cleanQuery)}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`iNews HTTP ${res.status}`);
  }

  const html = await res.text();
  const articleBlocks = [...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)];

  if (articleBlocks.length === 0) {
    return [];
  }

  const results = [];
  const queryWords = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const block of articleBlocks) {
    const raw = block[1];

    const linkMatch = raw.match(/href="(https:\/\/www\.inews\.id\/[^"]+)"/i);
    const titleMatch =
      raw.match(/<h3[^>]*class="cardTitle"[^>]*>([\s\S]*?)<\/h3>/i) ||
      raw.match(/title="([^"]+)"/i) ||
      raw.match(/alt="([^"]+)"/i);
    const imgMatch = raw.match(/src="(https:\/\/[^"]+)"/i);
    const kanalMatch = raw.match(/<div class="kanal">([\s\S]*?)<\/div>/i);
    const timeMatch = raw.match(/<div class="postTime">([\s\S]*?)<\/div>/i);

    if (linkMatch && titleMatch) {
      const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      const articleUrl = linkMatch[1];

      // Skip tautan listen / playlist / non-berita
      if (articleUrl.includes("/playlists/")) continue;

      // Verifikasi topik: pastikan berita berkaitan dengan kata kunci pencarian
      const titleLower = title.toLowerCase();
      const isRelevant =
        queryWords.length === 0 ||
        queryWords.some((word) => titleLower.includes(word));

      if (isRelevant && !results.some((r) => r.url === articleUrl)) {
        results.push({
          title,
          url: articleUrl,
          image: imgMatch ? imgMatch[1] : null,
          category: kanalMatch ? kanalMatch[1].trim() : "News",
          time: timeMatch ? timeMatch[1].trim() : "",
        });
      }
    }

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Membaca isi lengkap artikel iNews.id dari link
 * @param {string} articleUrl
 * @returns {Promise<{title: string, image: string|null, content: string, url: string}>}
 */
export async function getInewsArticle(articleUrl) {
  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: "https://www.inews.id/",
    Origin: "https://www.inews.id",
  });

  const res = await fetch(articleUrl, { headers });
  if (!res.ok) throw new Error(`iNews HTTP ${res.status}`);

  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Berita iNews";

  const imgMatch =
    html.match(/<meta property="og:image" content="([^"]+)"/i) ||
    html.match(/<img class="detail-img"[^>]*src="([^"]+)"/i);
  const image = imgMatch ? imgMatch[1] : null;

  const rawParagraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&lsquo;|&rsquo;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/<[^>]+>/g, "")
        .trim()
    )
    .filter(
      (p) =>
        p.length > 30 &&
        !p.toLowerCase().includes("baca juga") &&
        !p.toLowerCase().includes("simak breaking news") &&
        !p.toLowerCase().includes("editor :")
    );

  const content = rawParagraphs.slice(0, 6).join("\n\n");

  return {
    title,
    image,
    content: content || "Gagal mengekstrak isi teks artikel.",
    url: articleUrl,
  };
}
