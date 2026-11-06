import { scrapeDeepSeekR1 } from "./aiscrape.js";
import { postChatCompletions, buildMessages } from "./openai-compat.js";

/**
 * DeepSeek Service - Mengutamakan Free Web Scraping R1
 * @param {string} prompt
 * @param {object} options
 */
export async function askDeepSeek(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");

  // 1. Prioritas Utama: Scrape DeepSeek-R1 (Tanpa API Key)
  try {
    return await scrapeDeepSeekR1(clean);
  } catch (errScrape) {
    // 2. Fallback: jika ada DEEPSEEK_API_KEY terpasang
    const key = options.apiKey || process.env.DEEPSEEK_API_KEY;
    if (key) {
      const model = options.thinking ? "deepseek-reasoner" : "deepseek-chat";
      const r = await postChatCompletions({
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: key,
        model,
        messages: buildMessages(clean, options),
        timeoutMs: 45000,
      });
      return { ...r, source: "deepseek" };
    }
    throw errScrape;
  }
}

export function isDeepSeekConfigured() {
  return true; // Selalu aktif karena didukung free scraping
}

export default askDeepSeek;
