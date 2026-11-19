import { AI_TIMEOUT_MS, AIError, mkWaiter } from "./util.js";

/**
 * Catatan lapangan (diverifikasi 2026-11-19):
 * node siputzx.my.id mengembalikan HTTP 530 (origin down) untuk semua endpoint /api/ai/*.
 * Scraper tanpa API key dipertahankan sebagai last-resort, tapi statusnya DOWN by default
 * supaya tidak menghabiskan budget timeout di setiap request.
 */
export const SCRAPE_NODE_ENABLED = process.env.AI_SCRAPE_ENABLED === "1";
const NODE = "https://api.siputzx.my.id/api/ai";

function getJson(url, timeoutMs) {
  return fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 RizzerBot/AIScraper" },
    signal: AbortSignal.timeout(timeoutMs),
  }).then(async (res) => {
    const raw = await res.text().catch(() => "");
    if (!res.ok) throw new AIError(`HTTP ${res.status}`, { code: res.status === 530 ? "DOWN" : "HTTP" });
    try {
      return JSON.parse(raw);
    } catch (_) {
      throw new AIError("Respons scraping bukan JSON.", { code: "PARSE" });
    }
  });
}

function pickText(payload) {
  const d = payload?.data?.response ?? payload?.data ?? payload?.result ?? payload?.response ?? "";
  if (typeof d === "string") return d.trim();
  if (d && typeof d === "object" && typeof d.response === "string") return d.response.trim();
  return "";
}

function makeScraper({ name, source, path, param }) {
  return async function scrape(prompt, options = {}) {
    const clean = String(prompt || "").trim();
    if (!clean) throw new AIError("Prompt kosong.", { source, code: "INPUT" });
    if (!SCRAPE_NODE_ENABLED) {
      throw new AIError(`${name} scraping node dinonaktifkan (set AI_SCRAPE_ENABLED=1 untuk mengaktifkan).`, {
        source,
        code: "DISABLED",
      });
    }
    const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
    const url = `${NODE}/${path}?${param}=${encodeURIComponent(clean)}`;
    const payload = await getJson(url, Math.max(1000, wait.remaining()));
    const text = pickText(payload);
    if (!text) throw new AIError(`Gagal mengambil respons dari ${name}.`, { source, code: "EMPTY" });
    return { text, model: `${name} (Web Scrape)`, source, usage: null };
  };
}

export const scrapeDeepSeekR1 = makeScraper({ name: "DeepSeek-R1", source: "deepseek-scrape", path: "deepseekr1", param: "prompt" });
export const scrapeDuckAI = makeScraper({ name: "DuckAI", source: "duckai-scrape", path: "duckai", param: "message" });
export const scrapeMetaAI = makeScraper({ name: "Meta AI", source: "metaai-scrape", path: "metaai", param: "prompt" });

export async function askScrapedAI(prompt, options = {}) {
  const engines = [
    ["DeepSeek-R1", scrapeDeepSeekR1],
    ["DuckAI", scrapeDuckAI],
    ["Meta AI", scrapeMetaAI],
  ];
  const errors = {};
  for (const [name, fn] of engines) {
    try {
      return await fn(prompt, options);
    } catch (err) {
      errors[name] = err?.message || String(err);
    }
  }
  throw new AIError(`Semua AI scraping gagal: ${JSON.stringify(errors).slice(0, 200)}`, {
    source: "scrape",
    code: "ALL_FAILED",
  });
}

export default { scrapeDeepSeekR1, scrapeDuckAI, scrapeMetaAI, askScrapedAI };
