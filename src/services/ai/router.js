import { AI_TIMEOUT_MS, AIError, mkWaiter } from "./util.js";
import { askDeepSeek, deepseekCapabilities, isDeepSeekConfigured } from "./deepseek.js";
import { askOpenCode, opencodeCapabilities, OPENCODE_MODELS } from "./opencode.js";
import { askPollinations, pollinationsCapabilities } from "./pollinations.js";
import { askGroq, groqCapabilities, isGroqConfigured } from "../ai-keyed/groq.js";
import { askOpenRouter, isOpenRouterConfigured } from "../ai-keyed/openrouter.js";
import { askZen, ZEN_FREE } from "../ai-keyed/opencode-zen.js";
import { scrapeDeepSeekR1, scrapeDuckAI, scrapeMetaAI, SCRAPE_NODE_ENABLED } from "./aiscrape.js";

export const AI_SOURCES = {
  pollinations: { tier: 1, run: askPollinations, caps: pollinationsCapabilities, label: "Pollinations Public" },
  opencode: { tier: 1, run: askOpenCode, caps: opencodeCapabilities, label: "OpenCode Zen Free" },
  r1: { tier: 3, run: scrapeDeepSeekR1, caps: { history: false }, label: "DeepSeek R1 (scrape)" },
  duckai: { tier: 3, run: scrapeDuckAI, caps: { history: false }, label: "DuckAI (scrape)" },
  meta: { tier: 3, run: scrapeMetaAI, caps: { history: false }, label: "Meta AI (scrape)" },
  deepseek: { tier: 2, run: askDeepSeek, caps: deepseekCapabilities, label: "DeepSeek API" },
  groq: { tier: 2, run: askGroq, caps: groqCapabilities, label: "Groq API" },
  zen: { tier: 2, run: askZen, caps: { history: true }, label: "OpenCode Zen Pro" },
  openrouter: { tier: 2, run: askOpenRouter, caps: { history: true }, label: "OpenRouter Free" },
};

const ALIASES = {
  r1: "r1",
  deepseekr1: "r1",
  r1scrape: "r1",

  deepseek: "deepseek",
  ds: "deepseek",

  duckai: "duckai",
  duck: "duckai",
  duckduckgo: "duckai",
  ddg: "duckai",

  meta: "meta",
  metaai: "meta",
  llama: "meta",
  llama3: "meta",

  opencode: "opencode",
  oc: "opencode",
  zen: "zen",
  coding: "opencode",
  code: "opencode",

  pollinations: "pollinations",
  polli: "pollinations",
  pl: "pollinations",
  gptoss: "pollinations",

  groq: "groq",
  llama70b: "groq",

  openrouter: "openrouter",
  or: "openrouter",
  router: "openrouter",

  auto: "auto",
  scrape: "auto",
  free: "auto",
};

export function normalizeSource(s) {
  if (!s) return null;
  return ALIASES[String(s).toLowerCase()] || null;
}

function buildChain(prefer) {
  const list = [];
  if (prefer && prefer !== "auto" && AI_SOURCES[prefer]) list.push(prefer);
  const rest = Object.entries(AI_SOURCES)
    .filter(([name]) => name !== prefer)
    .sort((a, b) => a[1].tier - b[1].tier)
    .map(([name]) => name);
  return [...list, ...rest];
}

function skipReason(name, tier) {
  if (tier === 3 && !SCRAPE_NODE_ENABLED) return "nonaktif (node scraping dimatikan)";
  if (name === "deepseek" && !isDeepSeekConfigured()) return "nonaktif (butuh DEEPSEEK_API_KEY)";
  if (name === "groq" && !isGroqConfigured()) return "nonaktif (butuh GROQ_API_KEY)";
  if (name === "openrouter" && !isOpenRouterConfigured()) return "nonaktif (butuh OPENROUTER_API_KEY)";
  return null;
}

function shouldSkip(source) {
  return Boolean(skipReason(source.name, source.tier));
}

export async function askAI(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Pertanyaan tidak boleh kosong.", { code: "INPUT" });

  const budget = Math.max(5000, Number(options.timeoutMs) || AI_TIMEOUT_MS);
  const wait = mkWaiter(budget);
  const prefer = normalizeSource(options.prefer);
  const chain = buildChain(prefer);
  const attempts = [];

  for (const name of chain) {
    if (wait.remaining() < 2000) {
      attempts.push({ source: name, skipped: "budget habis" });
      continue;
    }
    const entry = AI_SOURCES[name];
    const reason = skipReason(name, entry.tier);
    if (reason) {
      attempts.push({ source: name, skipped: reason });
      continue;
    }

    const started = Date.now();
    try {
      const r = await entry.run(clean, { ...options, wait: options.wait || wait });
      return { ...r, source: name, attempts, latencyMs: Date.now() - started };
    } catch (err) {
      attempts.push({
        source: name,
        code: err?.code || "NETWORK",
        error: String(err?.message || err).slice(0, 160),
        ms: Date.now() - started,
      });
    }
  }

  const detail = attempts
    .map((a) => `${a.source}:${a.skipped || a.code || "FAIL"}`)
    .join(", ")
    .slice(0, 300);
  throw new AIError(`Semua engine AI gagal (${detail})`, { code: "ALL_FAILED", source: "router", attempts });
}

export function getAIStatus() {
  const out = {};
  for (const [name, s] of Object.entries(AI_SOURCES)) {
    out[name] = skipReason(name, s.tier) || `siap · ${s.label}`;
  }
  return out;
}

export function listSources() {
  return Object.entries(AI_SOURCES).map(([name, s]) => ({
    name,
    label: s.label,
    tier: s.tier,
    caps: s.caps,
    ready: !shouldSkip({ name, tier: s.tier }),
  }));
}

export { OPENCODE_MODELS, ZEN_FREE };

export default askAI;
