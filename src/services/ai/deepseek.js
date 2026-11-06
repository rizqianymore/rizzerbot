import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://api.deepseek.com/v1";
const MODELS = ["deepseek-chat", "deepseek-reasoner"];

export function isDeepSeekConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function askDeepSeek(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY belum dikonfigurasi.");

  const preferredModel = options.thinking || options.model === "deepseek-reasoner"
    ? "deepseek-reasoner"
    : "deepseek-chat";

  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: preferredModel,
    models: MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs || 60000,
  });
  return { ...r, source: "deepseek" };
}

export default askDeepSeek;
