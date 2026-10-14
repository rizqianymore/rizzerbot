import { askGemini, isGeminiConfigured } from "./gemini.js";
import { askGroq, isGroqConfigured } from "./groq.js";
import { askOpenRouter, isOpenRouterConfigured } from "./openrouter.js";
import { askCerebras, isCerebrasConfigured } from "./cerebras.js";
import { askMistral, isMistralConfigured } from "./mistral.js";
import { askGithubModels, isGithubModelsConfigured } from "./github-models.js";
import { askNvidia, isNvidiaConfigured } from "./nvidia.js";
import { askPollinations } from "./pollinations.js";
import { askDuckDuckGo, getLiveFreeModels } from "./duckduckgo/client.js";
import { ClaudeHaiku } from "./overchat.js";

export const AI_SOURCES = [
  "groq",
  "cerebras",
  "gemini",
  "mistral",
  "openrouter",
  "github",
  "nvidia",
  "duckduckgo",
  "pollinations",
  "claude",
];

const ALIASES = {
  ddg: "duckduckgo",
  duck: "duckduckgo",
  or: "openrouter",
  polli: "pollinations",
  pl: "pollinations",
  gm: "gemini",
  gq: "groq",
  cb: "cerebras",
  gh: "github",
  nv: "nvidia",
};

export function normalizeSource(s) {
  if (!s) return null;
  const k = String(s).toLowerCase();
  return ALIASES[k] || (AI_SOURCES.includes(k) ? k : null);
}

function keyedChain() {
  const chain = [];
  if (isGroqConfigured()) chain.push("groq");
  if (isCerebrasConfigured()) chain.push("cerebras");
  if (isGeminiConfigured()) chain.push("gemini");
  if (isMistralConfigured()) chain.push("mistral");
  if (isOpenRouterConfigured()) chain.push("openrouter");
  if (isGithubModelsConfigured()) chain.push("github");
  if (isNvidiaConfigured()) chain.push("nvidia");
  return chain;
}

async function runSource(source, clean, options) {
  if (source === "gemini") return { ...(await askGemini(clean, options)), source };
  if (source === "groq") return { ...(await askGroq(clean, options)), source };
  if (source === "cerebras") return { ...(await askCerebras(clean, options)), source };
  if (source === "mistral") return { ...(await askMistral(clean, options)), source };
  if (source === "openrouter") return { ...(await askOpenRouter(clean, options)), source };
  if (source === "github") return { ...(await askGithubModels(clean, options)), source };
  if (source === "nvidia") return { ...(await askNvidia(clean, options)), source };
  if (source === "duckduckgo") {
    const hist = Array.isArray(options.history) ? options.history : [];
    const input = hist.length ? [...hist, { role: "user", content: clean }] : clean;
    const r = await askDuckDuckGo(input, { model: options.model || "gpt-5.4-mini" });
    return { text: r.text, model: r.model, source };
  }
  if (source === "pollinations") return { ...(await askPollinations(clean, options)), source };
  if (source === "claude") {
    const r = await ClaudeHaiku(clean, options);
    if (!r.status) throw new Error(r.error || "Claude gagal");
    return { text: r.answer, model: r.model, source };
  }
  throw new Error(`Provider tidak dikenal: ${source}`);
}

export async function askAI(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const prefer = normalizeSource(options.prefer);
  const errors = {};

  const chain = [];
  if (prefer) chain.push(prefer);
  for (const s of keyedChain()) if (!chain.includes(s)) chain.push(s);
  for (const s of ["duckduckgo", "pollinations", "claude"]) if (!chain.includes(s)) chain.push(s);

  for (const source of chain) {
    try {
      return await runSource(source, clean, options);
    } catch (err) {
      errors[source] = err?.message || String(err);
    }
  }

  throw new Error(`Semua provider AI gagal: ${JSON.stringify(errors).slice(0, 300)}`);
}

export async function getAIStatus() {
  const status = {
    groq: isGroqConfigured() ? "key-ok" : "butuh GROQ_API_KEY (gratis: console.groq.com/keys)",
    cerebras: isCerebrasConfigured() ? "key-ok" : "butuh CEREBRAS_API_KEY (gratis: cloud.cerebras.ai)",
    gemini: isGeminiConfigured() ? "key-ok" : "butuh GEMINI_API_KEY (gratis: aistudio.google.com/apikey)",
    mistral: isMistralConfigured() ? "key-ok" : "butuh MISTRAL_API_KEY (gratis: console.mistral.ai)",
    openrouter: isOpenRouterConfigured() ? "key-ok" : "butuh OPENROUTER_API_KEY (gratis: openrouter.ai/keys)",
    github: isGithubModelsConfigured() ? "key-ok" : "butuh GITHUB_TOKEN (gratis: github.com/settings/tokens)",
    nvidia: isNvidiaConfigured() ? "key-ok" : "butuh NVIDIA_API_KEY (gratis: build.nvidia.com)",
    duckduckgo: "tanpa-key (scraping)",
    pollinations: "tanpa-key (legacy, 1 model)",
    claude: "tanpa-key (scraping)",
  };
  try {
    const live = await getLiveFreeModels();
    if (live?.size) status.duckduckgo = `tanpa-key (${live.size} model live)`;
  } catch {}
  return status;
}

export default askAI;
