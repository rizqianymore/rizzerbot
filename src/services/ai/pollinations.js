import { AI_TIMEOUT_MS, AIError, mkWaiter, chatFetch, buildMessages } from "./util.js";

const OPENAI_URL = "https://text.pollinations.ai/openai";
const MODEL = "openai";

export async function askPollinations(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt kosong.", { source: "pollinations", code: "INPUT" });

  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : Math.floor(Math.random() * 1_000_000);

  try {
    const r = await chatFetch({
      url: OPENAI_URL,
      model: MODEL,
      messages: buildMessages(clean, options),
      extraBody: { seed, referrer: "rizzerbot" },
      timeoutMs: options.timeoutMs || AI_TIMEOUT_MS,
      wait: options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS),
    });
    return { text: r.text, model: r.model || MODEL, source: "pollinations", usage: r.usage };
  } catch (err) {
    const code = err instanceof AIError ? err.code : "NETWORK";
    throw new AIError(err?.message || "Pollinations gagal merespons.", {
      source: "pollinations",
      code,
      retryMs: err?.retryMs || 0,
      cause: err,
    });
  }
}

export const pollinationsCapabilities = {
  history: true,
  seed: true,
  quota: "1 reply / 45s per IP (free tier)",
};

export default askPollinations;
