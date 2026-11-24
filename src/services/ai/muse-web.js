import { AI_TIMEOUT_MS, AIError, mkWaiter } from "./util.js";

const GRAPHQL_ENDPOINT = "https://graph.meta.ai/graphql";

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
    } catch (_) { }
  }
  return str;
}

export async function askMuseWeb(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new AIError("Prompt tidak boleh kosong.", { source: "muse-web", code: "INPUT" });

  const rawCookie = process.env.MUSE_COOKIE || process.env.META_COOKIE;
  const cookieString = parseCookies(rawCookie);

  const wait = options.wait || mkWaiter(options.timeoutMs || AI_TIMEOUT_MS);
  const budget = Math.max(1000, wait.remaining());

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    Accept: "text/event-stream, application/json, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "https://www.meta.ai",
    Referer: "https://www.meta.ai/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    ...(cookieString ? { Cookie: cookieString } : {}),
  };

  const payload = {
    lsd: "AVq",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "useAbraSendMessageMutation",
    variables: JSON.stringify({
      input: {
        message: { text: clean },
        external_conversation_id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        offline_threading_id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        source: "desktop_web",
      },
    }),
    doc_id: "7771747806240098",
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
      throw new AIError("Sesi Meta AI / Muse Web kedaluwarsa atau membutuhkan cookie yang valid.", {
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
      } catch (_) { }
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
      } catch (_) { }
    }

    if (!resultText) {
      const publicFallback = await fetch(
        `https://api.siputzx.my.id/api/ai/metaai?prompt=${encodeURIComponent(clean)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 RizzerBot/MuseWeb" },
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

    return {
      text: resultText.trim(),
      model: "Muse Code / Meta AI (Web)",
      source: "muse-web",
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

export default { askMuseWeb, isMuseConfigured, parseCookies, museCapabilities };
