import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://models.inference.ai.azure.com";
const FREE_MODELS = [
  "gpt-4o-mini",
  "meta-llama-3.1-70b-instruct",
  "DeepSeek-R1",
  "Phi-4",
];

export function isGithubModelsConfigured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

export async function askGithubModels(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || process.env.GITHUB_TOKEN;
  if (!key) throw new Error("GITHUB_TOKEN belum dikonfigurasi.");
  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: FREE_MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs,
  });
  return { ...r, source: "github" };
}

export default askGithubModels;
