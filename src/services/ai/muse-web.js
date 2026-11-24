import { AI_TIMEOUT_MS, AIError, mkWaiter } from "./util.js";

const GRAPHQL_ENDPOINT = "https://graph.meta.ai/graphql";

export const MUSE_MODELS = {
  "muse-spark": {
    id: "muse-spark",
    name: "Muse Spark (Fast Reasoning & Code)",
    docId: "7771747806240098",
    aliases: ["spark", "fast", "speed", "code"],
    promptPrefix:
      "Berperilaku sebagai Muse Spark: asisten pintar yang berpikir tajam, alami, dan to-the-point. Jawab dengan gaya natural manusia (humanized), hindari bahasa kaku robotik atau klise seperti 'Tentu, saya adalah AI'.\n\n",
    description: "Model cepat berfokus pada penalaran coding dan eksekusi instruksi ringkas & humanized.",
  },
  "muse-wonder": {
    id: "muse-wonder",
    name: "Muse Wonder (Deep Reasoning & Analysis)",
    docId: "7771747806240098",
    aliases: ["wonder", "deep", "think", "analysis"],
    promptPrefix:
      "Berperilaku sebagai Muse Wonder: analis tingkat tinggi dengan penalaran mendalam dan bahasa yang elegan, cerdas, serta humanis. Strukturkan jawaban secara logis tanpa basa-basi artifisial.\n\n",
    description: "Model analisis mendalam untuk pemecahan masalah rumit, logika, dan arsitektur.",
  },
  "llama-3.3-70b": {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B (General Chat)",
    docId: "7771747806240098",
    aliases: ["llama", "llama3", "llama70b", "general", "chat"],
    promptPrefix:
      "Jawablah dengan gaya bahasa yang ramah, santai, ekspresif, dan sangat manusiawi sesuai bahasa pengguna.\n\n",
    description: "Model serbaguna untuk percakapan natural dan tanya jawab umum.",
  },
};

export const DEFAULT_MUSE_MODEL = "muse-spark";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
];

export function resolveMuseModel(input) {
  if (!input) return MUSE_MODELS[DEFAULT_MUSE_MODEL];
  const query = String(input).trim().toLowerCase().replace(/^--?/, "");
  if (MUSE_MODELS[query]) return MUSE_MODELS[query];
  for (const model of Object.values(MUSE_MODELS)) {
    if (model.aliases.includes(query)) return model;
  }
  return MUSE_MODELS[DEFAULT_MUSE_MODEL];
}

export function isMuseConfigured() {
  return Boolean(process.env.MUSE_COOKIE || process.env.META_COOKIE);
}

export function parseCookies(rawCookie) {
  if (!rawCookie) return "";
  const str = String(rawCookie).trim();
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && item.name && item.value)
          .map((item) => `${item.name}=${item.value}`)
          .join("; ");
      }
    } catch (_) {}
  }
  return str;
}

export function checkCookieHealth(cookieStr) {
  if (!cookieStr) {
    return {
      healthy: false,
      hasAuth: false,
      hasSession: false,
      message: "Tidak ada cookie terpasang (berjalan di public fallback node)",
    };
  }

  const hasDatr = cookieStr.includes("datr=");
  const hasAbraSess = cookieStr.includes("abra_sess=") || cookieStr.includes("ecto_1_sess=");
  const hasCUser = cookieStr.includes("c_user=");
  const hasXs = cookieStr.includes("xs=");

  const hasAuth = hasAbraSess || (hasCUser && hasXs);

  return {
    healthy: Boolean(hasAuth || hasDatr),
    hasAuth,
    hasSession: hasAbraSess,
    message: hasAuth
      ? "Sesi autentikasi Meta AI aktif & valid"
      : hasDatr
        ? "Cookie terdeteksi (anonim/perangkat), siap dipakai"
        : "Format cookie tidak lengkap, berpotensi fallback",
  };
}

export function cleanHumanizedText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  let clean = rawText
    .replace(/^([*_\s]*)(Sebagai model AI|Sebagai AI|Saya adalah model bahasa|Sebagai asisten AI|Tentu, berikut adalah|Tentu saja,?)[*_\s,:-]*/i, "")
    .replace(/^([*_\s]*)(Berikut adalah jawaban(?:nya)?|Berikut ini(?: adalah)?)[*_\s,:-]*/i, "")
    .trim();

  clean = clean
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "");

  return clean;
}

function getRandomLsd() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "AV";
  for (let i = 0; i < 6; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

export async function askMuseWeb(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt tidak boleh kosong.", { source: "muse-web", code: "INPUT" });

  const selectedModel = resolveMuseModel(options.model || options.prefer);
  const rawCookie = process.env.MUSE_COOKIE || process.env.META_COOKIE;
  const cookieString = parseCookies(rawCookie);
  const cookieStatus = checkCookieHealth(cookieString);

  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const budget = Math.max(1000, wait.remaining());

  const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const isChrome = randomUA.includes("Chrome");

  const headers = {
    "User-Agent": randomUA,
    Accept: "text/event-stream, application/json, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "https://www.meta.ai",
    Referer: "https://www.meta.ai/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    ...(isChrome
      ? {
          "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="133", "Google Chrome";v="133"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        }
      : {}),
    ...(cookieString ? { Cookie: cookieString } : {}),
  };

  const finalPrompt = selectedModel.promptPrefix ? `${selectedModel.promptPrefix}${clean}` : clean;

  const payload = {
    lsd: getRandomLsd(),
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "useAbraSendMessageMutation",
    variables: JSON.stringify({
      input: {
        message: { text: finalPrompt },
        external_conversation_id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        offline_threading_id: `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`,
        source: "desktop_web",
        model: selectedModel.id,
      },
    }),
    doc_id: selectedModel.docId || "7771747806240098",
  };

  const bodyData = new URLSearchParams(payload).toString();

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers,
      body: bodyData,
      signal: AbortSignal.timeout(budget),
    });

    if (res.status === 401 || res.status === 403) {
      throw new AIError("Sesi Meta AI kedaluwarsa atau token invalid.", {
        source: "muse-web",
        code: "AUTH",
      });
    }

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      throw new AIError(`HTTP ${res.status}: ${raw.slice(0, 150)}`, {
        source: "muse-web",
        code: "HTTP",
      });
    }

    let resultText = "";

    const lines = raw.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const content = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
      if (!content || content === "[DONE]") continue;

      try {
        const json = JSON.parse(content);
        const snippet =
          json?.data?.node?.bot_response_message?.snippet ||
          json?.data?.node?.bot_response_message?.text?.text ||
          json?.data?.message?.text ||
          json?.text ||
          "";
        if (snippet && snippet.length > resultText.length) {
          resultText = snippet;
        }
      } catch (_) {}
    }

    if (!resultText) {
      try {
        const singleJson = JSON.parse(raw);
        resultText =
          singleJson?.data?.node?.bot_response_message?.snippet ||
          singleJson?.data?.node?.bot_response_message?.text?.text ||
          singleJson?.data?.message?.text ||
          singleJson?.text ||
          "";
      } catch (_) {}
    }

    if (!resultText) {
      const publicFallback = await fetch(
        `https://api.siputzx.my.id/api/ai/metaai?prompt=${encodeURIComponent(finalPrompt)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/MuseWeb" },
          signal: AbortSignal.timeout(Math.max(1000, wait.remaining())),
        }
      )
        .then((r) => r.json())
        .catch(() => null);

      const fallbackText =
        publicFallback?.data?.response ??
        publicFallback?.data ??
        publicFallback?.result ??
        publicFallback?.response ??
        "";

      if (fallbackText && typeof fallbackText === "string") {
        resultText = fallbackText.trim();
      }
    }

    if (!resultText) {
      throw new AIError("Tidak ada respons yang dapat diparsing dari Muse Web.", {
        source: "muse-web",
        code: "EMPTY",
      });
    }

    const humanized = cleanHumanizedText(resultText);

    return {
      text: humanized || resultText.trim(),
      model: selectedModel.name,
      source: "muse-web",
      cookieStatus,
      usage: null,
    };
  } catch (err) {
    if (err instanceof AIError) throw err;
    throw new AIError(`Gagal menghubungi Muse Web: ${err.message || err}`, {
      source: "muse-web",
      code: "NETWORK",
      cause: err,
    });
  }
}

export const museCapabilities = {
  history: false,
};

export default {
  askMuseWeb,
  isMuseConfigured,
  parseCookies,
  checkCookieHealth,
  cleanHumanizedText,
  museCapabilities,
  MUSE_MODELS,
  DEFAULT_MUSE_MODEL,
  resolveMuseModel,
};
