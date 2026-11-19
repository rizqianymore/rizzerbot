import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages } from "../ai/util.js";

/**
 * OpenRouter — banyak model gratis (`:free`).
 * Tier 2: hanya dipakai kalau OPENROUTER_API_KEY terpasang.
 */
const BASE = "https://openrouter.ai/api/v1";
const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
];

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function askOpenRouter(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "openrouter", code: "INPUT" });
  const key = options.apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new AIError("OPENROUTER_API_KEY belum dikonfigurasi.", { source: "openrouter", code: "AUTH" });

  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const chain = options.model ? [options.model] : FREE_MODELS;
  let lastErr = null;
  for (const model of chain) {
    if (wait.remaining() < 1500) break;
    try {
      const r = await chatFetch({
        url: `${BASE}/chat/completions`,
        apiKey: key,
        model,
        messages: buildMessages(clean, options),
        extraHeaders: { "HTTP-Referer": "https://github.com/rizqianymore/rizzerbot", "X-Title": "RizzerBot" },
        timeoutMs: wait.remaining(),
        wait,
      });
      return { text: r.text, model: r.model || model, source: "openrouter", usage: r.usage };
    } catch (err) {
      lastErr = err;
      if (err?.code === "AUTH") break;
    }
  }
  throw new AIError(lastErr?.message || "OpenRouter gagal merespons.", {
    source: "openrouter",
    code: lastErr?.code || "NETWORK",
    cause: lastErr,
  });
}

export default askOpenRouter;
