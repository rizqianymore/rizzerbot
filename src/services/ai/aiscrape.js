import https from "node:https";

function httpGetJson(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/AIScraper",
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (_) {
            resolve({ status: res.statusCode, data: null });
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout menghubungi server AI web scraping."));
    });
    req.on("error", (err) => reject(err));
  });
}

function cleanAnswer(rawText) {
  if (!rawText) return "";
  let text = String(rawText);
  // Bersihkan tag <think> jika ada
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return text;
}

/**
 * Scraping AI DeepSeek R1 Reasoning (Tanpa API Key)
 * @param {string} prompt
 * @returns {Promise<object>}
 */
export async function scrapeDeepSeekR1(prompt) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");

  const url = `https://api.siputzx.my.id/api/ai/deepseekr1?prompt=${encodeURIComponent(clean)}`;
  const res = await httpGetJson(url, 30000);

  const rawAns = res.data?.data?.response || res.data?.data || "";
  const answer = cleanAnswer(rawAns);

  if (!answer) {
    throw new Error("Gagal mengambil respons dari DeepSeek-R1 scraping node.");
  }

  return {
    text: answer,
    model: "DeepSeek-R1 (Web Scrape)",
    source: "deepseek-scrape",
  };
}

/**
 * Scraping AI DuckAI (Tanpa API Key)
 * @param {string} prompt
 * @returns {Promise<object>}
 */
export async function scrapeDuckAI(prompt) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");

  const url = `https://api.siputzx.my.id/api/ai/duckai?message=${encodeURIComponent(clean)}`;
  const res = await httpGetJson(url, 25000);

  const answer = res.data?.data?.response || res.data?.data || res.data?.result || "";
  if (!answer) {
    throw new Error("Gagal mengambil respons dari DuckAI scraping node.");
  }

  return {
    text: String(answer).trim(),
    model: "DuckAI Web",
    source: "duckai-scrape",
  };
}

/**
 * Scraping AI Meta Llama (Tanpa API Key)
 * @param {string} prompt
 * @returns {Promise<object>}
 */
export async function scrapeMetaAI(prompt) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");

  const url = `https://api.siputzx.my.id/api/ai/metaai?prompt=${encodeURIComponent(clean)}`;
  const res = await httpGetJson(url, 25000);

  const answer = res.data?.data?.response || res.data?.data || res.data?.result || "";
  if (!answer) {
    throw new Error("Gagal mengambil respons dari Meta AI scraping node.");
  }

  return {
    text: String(answer).trim(),
    model: "Llama 3 (Meta AI)",
    source: "metaai-scrape",
  };
}

/**
 * Universal Scraped AI Router (Auto-Fallback tanpa API Key)
 * @param {string} prompt
 * @returns {Promise<object>}
 */
export async function askScrapedAI(prompt) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Pertanyaan tidak boleh kosong.");

  const engines = [
    { name: "DeepSeek-R1", fn: scrapeDeepSeekR1 },
    { name: "DuckAI", fn: scrapeDuckAI },
    { name: "MetaAI", fn: scrapeMetaAI },
  ];

  const errors = {};
  for (const engine of engines) {
    try {
      return await engine.fn(clean);
    } catch (err) {
      errors[engine.name] = err.message;
    }
  }

  throw new Error(`Semua AI Scraping gagal: ${JSON.stringify(errors)}`);
}

export default { scrapeDeepSeekR1, scrapeDuckAI, scrapeMetaAI, askScrapedAI };
