import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages } from "../ai/util.js";

const BASE = "https://opencode.ai/zen/v1";

async function zenFetch({ options, model, messages }) {
  const key = options.apiKey || process.env.OPENCODE_API_KEY || "public";
  return chatFetch({
    url: `${BASE}/chat/completions`,
    apiKey: key,
    model,
    messages,
    extraHeaders: { "User-Agent": "opencode/1.1.0", "x-opencode-client": "cli" },
    timeoutMs: options.timeoutMs || AI_TIMEOUT_MS,
    wait: options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS),
  });
}

export const ZEN_FREE = ["deepseek-v4.1-flash-free", "mimo-v2.6-flash-free", "big-pickle"];

export async function askZen(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "zen", code: "INPUT" });
  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const chain = options.model ? [options.model] : ZEN_FREE;
  let lastErr = null;
  for (const model of chain) {
    if (wait.remaining() < 1500) break;
    try {
      const r = await zenFetch({ options, model, messages: buildMessages(clean, options) });
      return { text: r.text, model: r.model || model, source: "zen", usage: r.usage };
    } catch (err) {
      lastErr = err;
      if (err?.code === "QUOTA" || err?.code === "AUTH") break;
    }
  }
  throw new AIError(lastErr?.message || "OpenCode Zen gagal merespons.", {
    source: "zen",
    code: lastErr?.code || "NETWORK",
    cause: lastErr,
  });
}

export default { askZen, ZEN_FREE };
