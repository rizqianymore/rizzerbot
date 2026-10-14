import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://api.mistral.ai/v1";
const FREE_MODELS = ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"];

export function isMistralConfigured() {
  return Boolean(process.env.MISTRAL_API_KEY);
}

export async function askMistral(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY belum diisi di .env (gratis: console.mistral.ai).");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
  });
  return { ...r, source: "mistral" };
}

export default askMistral;
