import { askGemini, isGeminiConfigured } from "./gemini.js";
import { askGroq, isGroqConfigured } from "./groq.js";
import { askOpenRouter, isOpenRouterConfigured } from "./openrouter.js";
import { askPollinations } from "./pollinations.js";
import { askDuckDuckGo, getLiveFreeModels } from "./duckduckgo/client.js";
import { ClaudeHaiku } from "./overchat.js";

export const AI_SOURCES = ["gemini", "groq", "openrouter", "duckduckgo", "pollinations", "claude"];

const ALIASES = { ddg: "duckduckgo", duck: "duckduckgo", or: "openrouter", polli: "pollinations", pl: "pollinations", gm: "gemini" };

export function normalizeSource(s) {
  if (!s) return null;
  const k = String(s).toLowerCase();
  return ALIASES[k] || (AI_SOURCES.includes(k) ? k : null);
}

function keyedChain() {
  const chain = [];
  if (isGroqConfigured()) chain.push("groq");
  if (isGeminiConfigured()) chain.push("gemini");
  if (isOpenRouterConfigured()) chain.push("openrouter");
  return chain;
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
      if (source === "gemini") return { ...(await askGemini(clean, options)), source: "gemini" };
      if (source === "groq") return { ...(await askGroq(clean, options)), source: "groq" };
      if (source === "openrouter") return { ...(await askOpenRouter(clean, options)), source: "openrouter" };
      if (source === "duckduckgo") {
        const r = await askDuckDuckGo(clean, { model: options.model || "gpt-5.4-mini" });
        return { text: r.text, model: r.model, source: "duckduckgo" };
      }
      if (source === "pollinations") return { ...(await askPollinations(clean, options)), source: "pollinations" };
      if (source === "claude") {
        const r = await ClaudeHaiku(clean, options);
        if (!r.status) throw new Error(r.error || "Claude gagal");
        return { text: r.answer, model: r.model, source: "claude" };
      }
    } catch (err) {
      errors[source] = err?.message || String(err);
    }
  }

  throw new Error(`Semua provider AI gagal: ${JSON.stringify(errors).slice(0, 300)}`);
}

export async function getAIStatus() {
  const status = {
    groq: isGroqConfigured() ? "key-ok" : "butuh GROQ_API_KEY (gratis: console.groq.com/keys)",
    gemini: isGeminiConfigured() ? "key-ok" : "butuh GEMINI_API_KEY (gratis: aistudio.google.com/apikey)",
    openrouter: isOpenRouterConfigured() ? "key-ok" : "butuh OPENROUTER_API_KEY (gratis: openrouter.ai/keys)",
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
