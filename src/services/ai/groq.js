import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://api.groq.com/openai/v1";
const FREE_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function askGroq(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY belum diisi di .env (gratis di console.groq.com/keys).");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
  });
  return { ...r, source: "groq" };
}

export default askGroq;
