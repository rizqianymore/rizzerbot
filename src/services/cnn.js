import { randomUUID } from "node:crypto";
import { getRandomDevice, buildScraperHeaders } from "@/src/services/scrape.js";

const CNN_SEARCH_BASE = "https://search.prod.di.api.cnn.io/search/query";

/**
 * Cari berita di CNN via Stellar Search API dengan anti-bot header rotation
 *
 * @param {string} query - Kata kunci pencarian
 * @param {object} [options]
 * @param {number} [options.size=5] - Jumlah berita yang diambil
 * @param {number} [options.page=1] - Halaman hasil pencarian
 * @param {string} [options.sort="relevance"] - newest | relevance
 * @returns {Promise<{total: number, items: Array}>}
 */
export async function searchCNNNews(query, options = {}) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { total: 0, items: [] };

  const size = Math.min(Math.max(options.size || 5, 1), 20);
  const page = Math.max(options.page || 1, 1);
  const from = (page - 1) * size;
  const sort = options.sort || "relevance";
  const reqId = `stellar-search-${randomUUID()}`;

  const params = new URLSearchParams({
    q: cleanQuery,
    size: String(size),
    from: String(from),
    page: String(page),
    sort,
    tenant: "cnn-all-access",
    country: "ID",
    request_id: reqId,
    site: "cnn",
    zaid: "",
  });

  const url = `${CNN_SEARCH_BASE}?${params.toString()}`;

  const device = getRandomDevice();
  const headers = buildScraperHeaders(device, {
    Accept: "*/*",
    Origin: "https://edition.cnn.com",
    Referer: "https://edition.cnn.com/",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  });

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error(`CNN Search API HTTP ${res.status}`);
  }

  const data = await res.json();
  const total = data.meta?.of || data.meta?.total || 0;
  const rawResults = Array.isArray(data.result) ? data.result : [];

  const items = rawResults.map((item) => {
    let publishedDate = "";
    if (item.lastModifiedDate) {
      try {
        const d = new Date(item.lastModifiedDate);
        if (!isNaN(d.getTime())) {
          publishedDate = d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      } catch (_) {}
    }

    return {
      title: item.headline || "Tanpa Judul",
      snippet: (item.body || "").trim(),
      url: item.url || item.path || "",
      thumbnail: item.thumbnail || null,
      type: item.type || "NewsArticle",
      date: publishedDate,
    };
  });

  return {
    total,
    items,
  };
}
