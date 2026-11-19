import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages, stripThink } from "../ai/util.js";

const BASE = "https://api.groq.com/openai/v1";
const FREE_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function askGroq(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "groq", code: "INPUT" });
  const key = options.apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new AIError("GROQ_API_KEY belum dikonfigurasi.", { source: "groq", code: "AUTH" });

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
        timeoutMs: wait.remaining(),
        wait,
      });
      return { text: stripThink(r.text), model: r.model || model, source: "groq", usage: r.usage };
    } catch (err) {
      lastErr = err;
      if (err?.code === "AUTH") break;
    }
  }
  throw new AIError(lastErr?.message || "Groq gagal merespons.", {
    source: "groq",
    code: lastErr?.code || "NETWORK",
    retryMs: lastErr?.retryMs || 0,
    cause: lastErr,
  });
}

export const groqCapabilities = { history: true, seed: false };

export default askGroq;
