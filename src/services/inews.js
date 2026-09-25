/**
 * Scraper Berita iNews.id (Pencarian & Baca Artikel)
 */

const INEWS_SEARCH_URL = "https://www.inews.id/find";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * Mencari berita di iNews.id berdasarkan topik / kata kunci
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Promise<Array<{title: string, url: string, image: string|null, category: string, time: string}>>}
 */
export async function searchInews(query, limit = 5) {
  const url = `${INEWS_SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: DEFAULT_HEADERS });

  if (!res.ok) {
    throw new Error(`iNews HTTP ${res.status}`);
  }

  const html = await res.text();
  const articleBlocks = [...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)];

  if (articleBlocks.length === 0) {
    return [];
  }

  const results = [];

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
      // Skip tautan listen / playlist
      if (linkMatch[1].includes("/playlists/")) continue;

      results.push({
        title,
        url: linkMatch[1],
        image: imgMatch ? imgMatch[1] : null,
        category: kanalMatch ? kanalMatch[1].trim() : "News",
        time: timeMatch ? timeMatch[1].trim() : "",
      });
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
  const res = await fetch(articleUrl, { headers: DEFAULT_HEADERS });
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
