import { postChatCompletions, buildMessages } from "./openai-compat.js";

const BASE = "https://opencode.ai/zen/v1";
const MODELS = [
  "deepseek-v4-flash-free",
  "glm-5.3-flash-free",
  "qwen-2.5-coder-32b-free",
  "minimax-01-free",
];

export function isOpenCodeConfigured() {
  return Boolean(process.env.OPENCODE_API_KEY || process.env.OPENCODE_ZEN_API_KEY);
}

export async function askOpenCode(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");

  const key =
    options.apiKey ||
    process.env.OPENCODE_API_KEY ||
    process.env.OPENCODE_ZEN_API_KEY ||
    "public";

  const r = await postChatCompletions({
    baseUrl: BASE,
    apiKey: key,
    model: options.model,
    models: MODELS,
    messages: buildMessages(clean, options),
    timeoutMs: options.timeoutMs || 45000,
    extraHeaders: {
      "User-Agent": "opencode/1.1.0",
      "x-opencode-client": "cli",
    },
  });

  return { ...r, source: "opencode" };
}

export default askOpenCode;
