import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages, stripThink } from "./util.js";

const BASE = "https://api.deepseek.com/v1";

export async function askDeepSeek(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "deepseek", code: "INPUT" });

  const key = options.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AIError("DEEPSEEK_API_KEY belum dikonfigurasi.", { source: "deepseek", code: "AUTH" });

  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const model = options.model || (options.thinking ? "deepseek-reasoner" : "deepseek-chat");

  try {
    const r = await chatFetch({
      url: `${BASE}/chat/completions`,
      apiKey: key,
      model,
      messages: buildMessages(clean, options),
      timeoutMs: wait.remaining(),
      wait,
    });
    return { text: stripThink(r.text), model: r.model || model, source: "deepseek", usage: r.usage };
  } catch (err) {
    throw new AIError(err?.message || "DeepSeek gagal merespons.", {
      source: "deepseek",
      code: err?.code || "NETWORK",
      retryMs: err?.retryMs || 0,
      cause: err,
    });
  }
}

export function isDeepSeekConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export const deepseekCapabilities = { history: true, seed: false };

export default askDeepSeek;
