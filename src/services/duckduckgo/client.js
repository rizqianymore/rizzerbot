import { randomUUID } from "node:crypto";
import {
  solveDuckDuckGoChallenge,
  makeDuckDuckGoFeSignals,
} from "./challenge.js";
import {
  DUCKDUCKGO_DEFAULT_MODEL,
  normalizeDuckDuckGoModel,
  pickDuckDuckGoModel,
  extractFreeDuckDuckGoModelIds,
  FE_VERSION_PATTERN,
} from "./models.js";

const DUCKDUCKGO_BASE = "https://duck.ai";
const STATUS_URL = `${DUCKDUCKGO_BASE}/duckchat/v1/status`;
const CHAT_URL = `${DUCKDUCKGO_BASE}/duckchat/v1/chat`;
const MODELS_URL = `${DUCKDUCKGO_BASE}/duckchat/v1/models`;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const DEFAULT_FE_VERSION =
  "serp_20260424_180649_ET-0bdc33b2a02ebf8f235def65d887787f694720a1";

let modelsCache = null;
const MODEL_IDS_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Fetch available free model IDs with caching
 */
export async function getLiveFreeModels() {
  const now = Date.now();
  if (modelsCache && now - modelsCache.fetchedAt < MODEL_IDS_CACHE_TTL_MS) {
    return modelsCache.ids;
  }
  try {
    const res = await fetch(MODELS_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ids = extractFreeDuckDuckGoModelIds(data);
    if (ids.size > 0) {
      modelsCache = { ids, fetchedAt: now };
    }
    return ids;
  } catch (_) {
    return null;
  }
}

/**
 * Get required reasoning effort for specific DDG models
 */
function getReasoningEffort(model) {
  if (model === "claude-haiku-4-5") return "low";
  if (model === "tinfoil/gpt-oss-120b") return "low";
  return "none";
}

/**
 * Send chat request to DuckDuckGo Duck.ai
 *
 * @param {string|Array<{role: string, content: string}>} promptOrMessages
 * @param {object} options
 * @param {string} [options.model] - Target model (default: gpt-5.4-mini)
 * @param {string} [options.reasoningEffort] - 'none' | 'low'
 * @returns {Promise<{text: string, model: string}>}
 */
export async function askDuckDuckGo(promptOrMessages, options = {}) {
  let messages = [];
  if (typeof promptOrMessages === "string") {
    messages = [{ role: "user", content: promptOrMessages }];
  } else if (Array.isArray(promptOrMessages)) {
    messages = promptOrMessages;
  } else {
    throw new Error("Invalid prompt or messages parameter");
  }

  const requestedModel = normalizeDuckDuckGoModel(options.model || DUCKDUCKGO_DEFAULT_MODEL);
  const liveModels = await getLiveFreeModels();
  const effectiveModel = pickDuckDuckGoModel(requestedModel, liveModels);

  // 1. Get status and challenge header
  const statusResp = await fetch(STATUS_URL, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "Cache-Control": "no-store",
      "x-vqd-accept": "1",
      "User-Agent": DEFAULT_USER_AGENT,
      Origin: DUCKDUCKGO_BASE,
      Referer: `${DUCKDUCKGO_BASE}/`,
    },
  });

  if (!statusResp.ok) {
    throw new Error(`DuckDuckGo status request failed with HTTP ${statusResp.status}`);
  }

  const vqdHash = statusResp.headers.get("x-vqd-hash-1");
  const vqd4 = statusResp.headers.get("x-vqd-4");

  let solvedHash = null;
  if (vqdHash) {
    solvedHash = await solveDuckDuckGoChallenge(vqdHash, DEFAULT_USER_AGENT);
  }

  const reasoningEffort = options.reasoningEffort || getReasoningEffort(effectiveModel);

  const payload = {
    model: effectiveModel,
    metadata: {
      toolChoice: {
        NewsSearch: false,
        VideosSearch: false,
        LocalSearch: false,
        WeatherForecast: false,
      },
    },
    messages,
    canUseTools: true,
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };

  const headers = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    "User-Agent": DEFAULT_USER_AGENT,
    Origin: DUCKDUCKGO_BASE,
    Referer: `${DUCKDUCKGO_BASE}/`,
    "x-ddg-journey-id": randomUUID().replaceAll("-", ""),
    "x-fe-signals": makeDuckDuckGoFeSignals(),
    "x-fe-version": DEFAULT_FE_VERSION,
  };

  if (solvedHash) headers["x-vqd-hash-1"] = solvedHash;
  if (vqd4) headers["x-vqd-4"] = vqd4;

  const chatResp = await fetch(CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!chatResp.ok) {
    const errorText = await chatResp.text().catch(() => "");
    throw new Error(`DuckDuckGo chat failed with HTTP ${chatResp.status}: ${errorText.slice(0, 200)}`);
  }

  const responseText = await chatResp.text();
  const lines = responseText.split("\n");
  let resultAnswer = "";
  let resolvedModel = effectiveModel;

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.model) resolvedModel = parsed.model;
        if (parsed.message) resultAnswer += parsed.message;
      } catch (_) {}
    }
  }

  return {
    text: resultAnswer.trim(),
    model: resolvedModel,
  };
}
