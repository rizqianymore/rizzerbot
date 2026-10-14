import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://openrouter.ai/api/v1";
const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwen3-coder:free",
];

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function askOpenRouter(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY belum diisi di .env (gratis di openrouter.ai/keys).");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
    extraHeaders: {
      "HTTP-Referer": "https://github.com/rizzerbot",
      "X-Title": "RizzerBot",
    },
  });
  return { ...r, source: "openrouter" };
}

export default askOpenRouter;
