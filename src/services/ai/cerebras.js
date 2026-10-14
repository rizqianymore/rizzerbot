import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://api.cerebras.ai/v1";
const FREE_MODELS = ["llama-3.3-70b", "llama-4-scout-17b-16e-instruct", "gpt-oss-120b"];

export function isCerebrasConfigured() {
  return Boolean(process.env.CEREBRAS_API_KEY);
}

export async function askCerebras(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error("CEREBRAS_API_KEY belum diisi di .env (gratis: cloud.cerebras.ai).");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
  });
  return { ...r, source: "cerebras" };
}

export default askCerebras;
