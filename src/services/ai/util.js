export const AI_TIMEOUT_MS = 30000;
export const AI_MAX_CHARS = 3900;
const RETRY_AFTER_RE = /\/retryafter:(\d+(?:\.\d+)?)/i;

export class AIError extends Error {
  constructor(message, { source = "", code = "", retryMs = 0, cause = null, attempts = null } = {}) {
    super(message);
    this.name = "AIError";
    this.source = source;
    this.code = code;
    this.retryMs = retryMs;
    this.cause = cause;
    this.attempts = attempts;
  }
}

function parseRetryMs(msg) {
  const m = String(msg || "").match(RETRY_AFTER_RE);
  return m ? Math.ceil(Number(m[1]) * 1000) : 0;
}

function classifyStatus(status, body) {
  if (status === 429) return "RATE_LIMIT";
  if (status === 402) return "QUOTA";
  if (status === 401 || status === 403) return "AUTH";
  if (status === 404) return "NOT_FOUND";
  if (/FreeUsageLimit|FREE_LIMIT/i.test(body)) return "QUOTA";
  return status >= 500 ? "SERVER" : "HTTP";
}

export function mkWaiter(timeoutMs = AI_TIMEOUT_MS) {
  const start = Date.now();
  return {
    remaining: () => Math.max(0, timeoutMs - (Date.now() - start)),
    elapsed: () => Date.now() - start,
  };
}

export async function chatFetch({
  url,
  apiKey,
  model,
  messages,
  extraBody = {},
  extraHeaders = {},
  timeoutMs = AI_TIMEOUT_MS,
  wait,
}) {
  const budget = Math.max(1000, wait ? wait.remaining() : timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, ...extraBody }),
    signal: AbortSignal.timeout(budget),
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    throw new AIError(`HTTP ${res.status}: ${raw.slice(0, 150)}`, {
      code: classifyStatus(res.status, raw),
      retryMs: parseRetryMs(raw),
    });
  }
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    throw new AIError("Respons bukan JSON yang valid.", { code: "PARSE" });
  }
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new AIError("Respons kosong dari model.", { code: "EMPTY" });
  return { text, model: data?.model || model, usage: data?.usage || null };
}

export function stripThink(text) {
  return String(text || "")
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

export function buildMessages(prompt, options = {}) {
  const defaultSystem =
    options.system ||
    "Kamu adalah teman ngobrol WhatsApp yang santai, cerdas, dan asik. Jawab ringkas, to the point, dan natural seperti gaya chat manusia. Hindari format kodingan panjang, basa-basi AI atau jawaban bertele-tele.";

  return [
    {
      role: "system",
      content: defaultSystem,
    },
    ...(Array.isArray(options.history) ? options.history : []),
    { role: "user", content: String(prompt).trim() },
  ];
}

export function splitChunks(text, size = AI_MAX_CHARS) {
  const s = String(text || "").trim();
  if (!s) return [];
  if (s.length <= size) return [s];
  const parts = [];
  let rest = s;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.6) cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.6) cut = size;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const byWords = Math.ceil(words.length * 1.33);
  const byChars = Math.ceil(text.length / 3.8);
  return Math.max(1, Math.round((byWords + byChars) / 2));
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
