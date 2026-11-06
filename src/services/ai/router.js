import { askGemini, isGeminiConfigured } from "./gemini.js";
import { askGroq, isGroqConfigured } from "./groq.js";
import { askDeepSeek, isDeepSeekConfigured } from "./deepseek.js";
import { askOpenRouter, isOpenRouterConfigured } from "./openrouter.js";
import { askCerebras, isCerebrasConfigured } from "./cerebras.js";
import { askMistral, isMistralConfigured } from "./mistral.js";
import { askGithubModels, isGithubModelsConfigured } from "./github-models.js";
import { askNvidia, isNvidiaConfigured } from "./nvidia.js";
import { askPollinations } from "./pollinations.js";

export const AI_SOURCES = [
  "gemini",
  "groq",
  "deepseek",
  "cerebras",
  "mistral",
  "openrouter",
  "github",
  "nvidia",
  "pollinations",
];

const ALIASES = {
  gm: "gemini",
  google: "gemini",
  gq: "groq",
  ds: "deepseek",
  r1: "deepseek",
  cb: "cerebras",
  mis: "mistral",
  or: "openrouter",
  gh: "github",
  nv: "nvidia",
  polli: "pollinations",
  pl: "pollinations",
};

export function normalizeSource(s) {
  if (!s) return null;
  const k = String(s).toLowerCase();
  return ALIASES[k] || (AI_SOURCES.includes(k) ? k : null);
}

function keyedChain() {
  const chain = [];
  if (isGeminiConfigured()) chain.push("gemini");
  if (isGroqConfigured()) chain.push("groq");
  if (isDeepSeekConfigured()) chain.push("deepseek");
  if (isCerebrasConfigured()) chain.push("cerebras");
  if (isMistralConfigured()) chain.push("mistral");
  if (isOpenRouterConfigured()) chain.push("openrouter");
  if (isGithubModelsConfigured()) chain.push("github");
  if (isNvidiaConfigured()) chain.push("nvidia");
  return chain;
}

async function runSource(source, clean, options) {
  if (source === "gemini") return { ...(await askGemini(clean, options)), source };
  if (source === "groq") return { ...(await askGroq(clean, options)), source };
  if (source === "deepseek") return { ...(await askDeepSeek(clean, options)), source };
  if (source === "cerebras") return { ...(await askCerebras(clean, options)), source };
  if (source === "mistral") return { ...(await askMistral(clean, options)), source };
  if (source === "openrouter") return { ...(await askOpenRouter(clean, options)), source };
  if (source === "github") return { ...(await askGithubModels(clean, options)), source };
  if (source === "nvidia") return { ...(await askNvidia(clean, options)), source };
  if (source === "pollinations") return { ...(await askPollinations(clean, options)), source };
  throw new Error(`Provider AI tidak dikenal: ${source}`);
}

export async function askAI(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt pertanyaan tidak boleh kosong.");
  const prefer = normalizeSource(options.prefer);
  const errors = {};

  const chain = [];
  if (prefer) chain.push(prefer);
  for (const s of keyedChain()) {
    if (!chain.includes(s)) chain.push(s);
  }
  for (const s of ["pollinations"]) {
    if (!chain.includes(s)) chain.push(s);
  }

  if (chain.length === 0) {
    throw new Error(
      "Tidak ada provider AI yang aktif. Konfigurasikan minimal satu API Key (GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, dll) di config/settings.js."
    );
  }

  for (const source of chain) {
    try {
      return await runSource(source, clean, options);
    } catch (err) {
      errors[source] = err?.message || String(err);
    }
  }

  throw new Error(`Seluruh provider AI gagal: ${JSON.stringify(errors).slice(0, 300)}`);
}

export function getAIStatus() {
  return {
    gemini: isGeminiConfigured() ? "Siap (GEMINI_API_KEY aktif)" : "Belum aktif (aistudio.google.com/apikey)",
    groq: isGroqConfigured() ? "Siap (GROQ_API_KEY aktif)" : "Belum aktif (console.groq.com/keys)",
    deepseek: isDeepSeekConfigured() ? "Siap (DEEPSEEK_API_KEY aktif)" : "Belum aktif (platform.deepseek.com)",
    cerebras: isCerebrasConfigured() ? "Siap (CEREBRAS_API_KEY aktif)" : "Belum aktif (cloud.cerebras.ai)",
    mistral: isMistralConfigured() ? "Siap (MISTRAL_API_KEY aktif)" : "Belum aktif (console.mistral.ai)",
    openrouter: isOpenRouterConfigured() ? "Siap (OPENROUTER_API_KEY aktif)" : "Belum aktif (openrouter.ai/keys)",
    github: isGithubModelsConfigured() ? "Siap (GITHUB_TOKEN aktif)" : "Belum aktif (github.com/settings/tokens)",
    nvidia: isNvidiaConfigured() ? "Siap (NVIDIA_API_KEY aktif)" : "Belum aktif (build.nvidia.com)",
    pollinations: "Publik / Fallback (Tanpa API Key)",
  };
}

export default askAI;
