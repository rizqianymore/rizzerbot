/**
 * Scraper pencarian gambar Pinterest (via Nexray) & Web Images (via Bing High-Res)
 */

/**
 * Cari gambar Pinterest via API Nexray
 * @param {string} query
 * @returns {Promise<Array<{title: string, image: string, pin: string, author: string}>>}
 */
export async function searchPinterest(query) {
  const url = `https://api.nexray.eu.cc/search/pinterest?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) throw new Error(`Pinterest API HTTP ${res.status}`);
  const data = await res.json();

  if (!data.status || !Array.isArray(data.result) || data.result.length === 0) {
    throw new Error(`Tidak ditemukan pin untuk "${query}"`);
  }

  return data.result.map((item) => ({
    title: item.grid_title || item.seo_alt_text || item.description || query,
    image: item.images_url,
    pin: item.pin,
    author: item.pinner?.full_name || item.pinner?.username || "Pinterest User",
  }));
}

/**
 * Scrape gambar web resolusi tinggi via Bing Images
 * @param {string} query
 * @param {number} [limit=15]
 * @returns {Promise<Array<{url: string, title: string, source: string}>>}
 */
export async function scrapeWebImages(query, limit = 15) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) throw new Error(`Bing Image Scrape HTTP ${res.status}`);
  const html = await res.text();

  const pattern = /m="{([^"]+)}"/g;
  const items = [];

  for (const m of html.matchAll(pattern)) {
    const jsonStr = "{" + m[1].replace(/&quot;/g, '"') + "}";
    try {
      const obj = JSON.parse(jsonStr);
      if (obj.murl && obj.murl.startsWith("http")) {
        items.push({
          url: obj.murl,
          title: obj.t || query,
          source: obj.purl || "",
        });
      }
    } catch (_) {}
    if (items.length >= limit) break;
  }

  if (items.length === 0) {
    throw new Error(`Tidak ditemukan gambar untuk "${query}"`);
  }

  return items;
}
