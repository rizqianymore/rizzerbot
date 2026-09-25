import { randomUUID } from "node:crypto";

const CNN_SEARCH_BASE = "https://search.prod.di.api.cnn.io/search/query";

const DEFAULT_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Origin: "https://edition.cnn.com",
  Referer: "https://edition.cnn.com/",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
};

/**
 * Cari berita di CNN via Stellar Search API
 *
 * @param {string} query - Kata kunci pencarian
 * @param {object} [options]
 * @param {number} [options.size=5] - Jumlah berita yang diambil
 * @param {number} [options.page=1] - Halaman hasil pencarian
 * @param {string} [options.sort="newest"] - newest | relevance
 * @returns {Promise<{total: number, items: Array}>}
 */
export async function searchCNNNews(query, options = {}) {
  const size = Math.min(Math.max(options.size || 5, 1), 20);
  const page = Math.max(options.page || 1, 1);
  const from = (page - 1) * size;
  const sort = options.sort || "newest";
  const reqId = `stellar-search-${randomUUID()}`;

  const params = new URLSearchParams({
    q: query,
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

  const res = await fetch(url, {
    method: "GET",
    headers: DEFAULT_HEADERS,
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
