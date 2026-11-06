import { askDeepSeek } from "./deepseek.js";
import { askOpenCode } from "./opencode.js";
import { askPollinations } from "./pollinations.js";
import { askScrapedAI, scrapeDeepSeekR1, scrapeDuckAI, scrapeMetaAI } from "./aiscrape.js";

export const AI_SOURCES = [
  "r1",
  "deepseek",
  "duckai",
  "meta",
  "opencode",
  "pollinations",
];

const ALIASES = {
  // DeepSeek & R1
  r1: "r1",
  deepseek: "deepseek",
  ds: "deepseek",
  r1scrape: "r1",
  deepseekr1: "r1",

  // DuckAI
  duckai: "duckai",
  duck: "duckai",
  duckduckgo: "duckai",
  ddg: "duckai",

  // Meta Llama
  meta: "meta",
  metaai: "meta",
  llama: "meta",
  llama3: "meta",

  // OpenCode Zen
  opencode: "opencode",
  oc: "opencode",
  zen: "opencode",
  code: "opencode",

  // Pollinations Free
  pollinations: "pollinations",
  polli: "pollinations",
  pl: "pollinations",

  // Universal
  auto: "auto",
  scrape: "auto",
  free: "auto",
};

export function normalizeSource(s) {
  if (!s) return null;
  const k = String(s).toLowerCase();
  return ALIASES[k] || null;
}

async function runSource(source, clean, options) {
  if (source === "r1" || source === "deepseek") return await scrapeDeepSeekR1(clean);
  if (source === "duckai") return await scrapeDuckAI(clean);
  if (source === "meta") return await scrapeMetaAI(clean);
  if (source === "opencode") return await askOpenCode(clean, options);
  if (source === "pollinations") return await askPollinations(clean, options);
  if (source === "auto") return await askScrapedAI(clean);
  throw new Error(`Model AI tidak dikenal: ${source}`);
}

/**
 * Universal AI Gateway - 100% Non API Key (Web Scraped & Free Public Engines)
 * @param {string} prompt
 * @param {object} options
 */
export async function askAI(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Pertanyaan tidak boleh kosong.");
  const prefer = normalizeSource(options.prefer);
  const errors = {};

  // Rantai eksekusi 100% Free / Scraped
  const chain = [];
  if (prefer && prefer !== "auto") chain.push(prefer);
  
  // Auto-failover sequence across free web engines
  for (const s of ["r1", "duckai", "opencode", "meta", "pollinations"]) {
    if (!chain.includes(s)) chain.push(s);
  }

  for (const source of chain) {
    try {
      return await runSource(source, clean, options);
    } catch (err) {
      errors[source] = err?.message || String(err);
    }
  }

  throw new Error(`Seluruh model AI non-API Key gagal merespons: ${JSON.stringify(errors).slice(0, 300)}`);
}

export function getAIStatus() {
  return {
    "deepseek-r1": "Aktif (Web Scrape Live - Tanpa API Key)",
    "duckai": "Aktif (DuckAI Web - Tanpa API Key)",
    "opencode-zen": "Aktif (OpenCode Free Models - Tanpa API Key)",
    "meta-llama": "Aktif (Meta AI Web - Tanpa API Key)",
    "pollinations": "Aktif (Public Node - Tanpa API Key)",
  };
}

export default askAI;
