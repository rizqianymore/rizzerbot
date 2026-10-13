import { request } from "@/src/utils/request.js";

export async function searchPinterest(query) {
  const url = `https://api.nexray.eu.cc/search/pinterest?q=${encodeURIComponent(query)}`;
  const data = await request.json(url, { timeout: 20000 });

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

export async function scrapeWebImages(query, limit = 15) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&scenario=ImageBasicHover`;
  const html = await request.text(url, {
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    timeout: 20000,
    via: "brightdata",
  });

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
