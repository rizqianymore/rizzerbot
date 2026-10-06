import { getRandomDevice, buildScraperHeaders } from "@/src/services/scrape.js";
import { request } from "@/src/utils/request.js";

const INEWS_SEARCH_URL = "https://www.inews.id/find";

export async function searchInews(query, limit = 5) {
  const cleanQuery = String(query || "").trim().slice(0, 200);
  if (!cleanQuery) return [];

  const maxResults = Math.min(Math.max(Number(limit) || 5, 1), 20);

  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: "https://www.inews.id/",
    Origin: "https://www.inews.id",
    "Sec-Fetch-Site": "same-origin",
  });

  const url = `${INEWS_SEARCH_URL}?q=${encodeURIComponent(cleanQuery)}`;
  const html = await request.text(url, { headers, timeout: 15000, bypassCloudflare: "auto" });
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

      if (articleUrl.includes("/playlists/")) continue;

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

    if (results.length >= maxResults) break;
  }

  return results;
}

export async function getInewsArticle(articleUrl) {
  if (!String(articleUrl || "").startsWith("https://www.inews.id/")) {
    throw new Error("URL artikel iNews tidak valid");
  }
  const device = getRandomDevice("desktop");
  const headers = buildScraperHeaders(device, {
    Referer: "https://www.inews.id/",
    Origin: "https://www.inews.id",
  });

  const html = await request.text(articleUrl, { headers, timeout: 15000, bypassCloudflare: "auto" });

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
