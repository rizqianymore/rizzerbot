import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages } from "./util.js";

const BASE = "https://opencode.ai/zen/v1";

export const OPENCODE_MODELS = [
  "deepseek-v4.1-flash-free",
  "mimo-v2.6-flash-free",
  "big-pickle",
];

export function isOpenCodeConfigured() {
  return true;
}

export async function askOpenCode(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "opencode", code: "INPUT" });

  const key = options.apiKey || process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_API_KEY || "public";
  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const chain = options.model ? [options.model] : OPENCODE_MODELS;
  let lastErr = null;

  for (const model of chain) {
    if (wait.remaining() < 1500) break;
    try {
      const r = await chatFetch({
        url: `${BASE}/chat/completions`,
        apiKey: key,
        model,
        messages: buildMessages(clean, options),
        extraHeaders: {
          "User-Agent": "opencode/1.1.0",
          "x-opencode-client": "cli",
        },
        timeoutMs: wait.remaining(),
        wait,
      });
      return { text: r.text, model: r.model || model, source: "opencode", usage: r.usage };
    } catch (err) {
      lastErr = err;
      if (err?.code === "QUOTA" || err?.code === "AUTH") break;
    }
  }

  throw new AIError(lastErr?.message || "OpenCode Zen tidak merespons.", {
    source: "opencode",
    code: lastErr?.code || "NETWORK",
    retryMs: lastErr?.retryMs || 0,
    cause: lastErr,
  });
}

export const opencodeCapabilities = {
  history: true,
  seed: false,
  notes: "Free tier dibatasi per akun; model deprecated otomatis di-skip oleh chain.",
};

export default askOpenCode;
