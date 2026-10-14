import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://integrate.api.nvidia.com/v1";
const FREE_MODELS = [
  "meta/llama-3.3-70b-instruct",
  "deepseek-ai/deepseek-r1",
  "mistralai/mistral-large-2-instruct",
];

export function isNvidiaConfigured() {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export async function askNvidia(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY belum diisi di .env (gratis: build.nvidia.com).");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
  });
  return { ...r, source: "nvidia" };
}

export default askNvidia;
