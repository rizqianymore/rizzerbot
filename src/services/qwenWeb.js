import crypto from "crypto";
import { db } from "@/src/core/database.js";

const BASE_URL = "https://chat.qwen.ai";
const CHATS_NEW_URL = `${BASE_URL}/api/v2/chats/new`;
const CHAT_COMPLETIONS_URL = `${BASE_URL}/api/v2/chat/completions`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const BX_VERSION = "2.5.36";
const BX_UMIDTOKEN_FALLBACK = "T2gA0000000000000000000000000000000000000000";
const QWEN_SPA_VERSION = "0.2.81";

export const MODEL_ALIASES = {
  "qwen-plus": "qwen3.7-plus",
  "qwen-max": "qwen3.7-max",
  "qwen-turbo": "qwen3.6-plus",
  "qwen3-plus": "qwen3.7-plus",
  "qwen3-max": "qwen3.7-max",
  "qwen3-flash": "qwen3.6-plus",
  "qwen3.8-max-preview": "qwen3.8-max",
  "qwen3-coder-flash": "qwen3.6-plus",
  qwen: "qwen3.7-max",
  qwen3: "qwen3.7-max",
  coder: "qwen3-coder-plus",
  "coder-plus": "qwen3-coder-plus",
  plus: "qwen3.7-plus",
  max: "qwen3.7-max",
  turbo: "qwen3.6-plus",
};

export const DEFAULT_MODEL = "qwen3.7-max";
const REQUIRED_THINKING_MODELS = new Set(["qwen3.8-max"]);

export function mapModel(modelId = "") {
  if (!modelId) return DEFAULT_MODEL;
  const key = modelId.toLowerCase().trim();
  return MODEL_ALIASES[key] || modelId;
}

export function stripCookieInputPrefix(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) return "";
  const withoutBearer = trimmed.replace(/^bearer\s+/i, "");
  return withoutBearer.replace(/^cookie:\s*/i, "").trim();
}

export function parseJsonCookiesToHeader(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed || !trimmed.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    const parts = [];
    for (const entry of parsed) {
      if (entry && typeof entry === "object" && entry.name && typeof entry.value === "string") {
        parts.push(`${entry.name}=${entry.value}`);
      }
    }
    return parts.join("; ");
  } catch {
    return null;
  }
}

export function buildQwenCookieHeader(rawValue) {
  const trimmed = stripCookieInputPrefix(rawValue);
  if (!trimmed) return "";
  const jsonResult = parseJsonCookiesToHeader(trimmed);
  if (jsonResult !== null) return jsonResult;
  if (!trimmed.includes("=")) return "";
  return trimmed;
}

export function extractQwenToken(rawValue) {
  const trimmed = stripCookieInputPrefix(rawValue);
  if (!trimmed) return "";
  if (!trimmed.includes("=")) return trimmed;
  const match = trimmed.match(/(?:^|;\s*)token=([^;\s]+)/);
  return match ? match[1] : "";
}

function buildApiHeaders(token, cookieHeader, chatId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "*/*",
    "User-Agent": USER_AGENT,
    Origin: BASE_URL,
    Referer: chatId ? `${BASE_URL}/c/${chatId}` : `${BASE_URL}/`,
    source: "web",
    version: QWEN_SPA_VERSION,
    "x-request-id": crypto.randomUUID(),
    "bx-v": BX_VERSION,
    "bx-umidtoken": BX_UMIDTOKEN_FALLBACK,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  return headers;
}

function isWafResponse(status, contentType = "", bodyText = "") {
  if (contentType.includes("text/html")) return true;
  if (status === 504) return true;
  return /aliyun_waf|baxia|FAIL_SYS_USER_VALIDATE|RGV587_ERROR|x5secdata|<html/i.test(bodyText);
}

const WAF_ERROR_MESSAGE =
  "⚠️ *Verifikasi Keamanan Alibaba (Captcha Challenge):*\n" +
  "Akun Qwen terkena proteksi Alibaba WAF/Slider Captcha (x5sec).\n\n" +
  "👉 *Solusi:*\n" +
  "1. Buka https://chat.qwen.ai di browser & kirim 1 pesan tes.\n" +
  "2. Selesaikan verifikasi/captcha jika muncul di browser.\n" +
  "3. Salin Cookie baru lalu perbarui via `.ai --cookie <cookie_baru>`\n\n" +
  "💡 *Tips:* Anda juga bisa menggunakan API Key DashScope Alibaba (`sk-...`) via `.ai --cookie sk-...` untuk akses bebas Captcha.";

function parseSseDelta(line) {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;

  try {
    const parsed = JSON.parse(payload);
    const delta = parsed?.choices?.[0]?.delta;
    if (!delta) return null;
    const phase = delta.phase;
    const content = typeof delta.content === "string" ? delta.content : "";
    if (phase === "think" || phase === "thinking_summary") {
      return { kind: "think", text: content };
    }
    if (phase === "answer" || phase === null || phase === undefined) {
      return { kind: "answer", text: content };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Eksekusi tanya jawab Qwen Web (OmniRoute Port) & DashScope Fallback
 */
export async function askQwenWeb({
  prompt,
  model = DEFAULT_MODEL,
  cookie = process.env.QWEN_COOKIE || process.env.DASHSCOPE_API_KEY || db.data?.settings?.qwenCookie || "",
  includeThinking = false,
  signal,
}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Pertanyaan/prompt tidak boleh kosong.");
  }

  const rawCred = (cookie || "").trim();
  if (!rawCred) {
    throw new Error(
      "Cookie sesi Qwen belum dikonfigurasi.\n\n" +
      "👉 *Cara Mengatur Cookie:*\n" +
      "1. Login ke https://chat.qwen.ai di browser\n" +
      "2. Salin isi header Cookie (F12 > Network / Storage)\n" +
      "3. Ketik perintah: `.ai --cookie <paste_cookie_disini>`\n" +
      "*(atau gunakan API Key Alibaba DashScope: `.ai --cookie sk-...`)*"
    );
  }

  // ── Mode: DashScope Official API Key (sk-...) ─────────────────────────────
  if (rawCred.startsWith("sk-")) {
    const modelId = mapModel(model);
    const dashscopeUrl = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
    const res = await fetch(dashscopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawCred}`,
      },
      body: JSON.stringify({
        model: modelId.includes("qwen") ? modelId : "qwen-plus",
        messages: [{ role: "user", content: prompt.trim() }],
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`DashScope API Error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return {
      content: content.trim() || "*(Tidak ada balasan)*",
      reasoning: "",
      model: modelId,
    };
  }

  // ── Mode: Qwen Web Session (OmniRoute Engine) ─────────────────────────────
  const cookieHeader = buildQwenCookieHeader(rawCred);
  const token = extractQwenToken(rawCred);
  const modelId = mapModel(model);
  const enableThinking =
    REQUIRED_THINKING_MODELS.has(modelId) ||
    includeThinking ||
    /think|reason|r1/i.test(model);

  // ── Step 1: Create Chat Session ──────────────────────────────────────────
  let chatId = "";
  try {
    const newChatRes = await fetch(CHATS_NEW_URL, {
      method: "POST",
      headers: buildApiHeaders(token, cookieHeader),
      body: JSON.stringify({
        title: "New Chat",
        models: [modelId],
        chat_mode: "normal",
        chat_type: "t2t",
        timestamp: Date.now(),
      }),
      signal,
    });

    const ct = newChatRes.headers.get("content-type") || "";
    const text = await newChatRes.text().catch(() => "");

    if (isWafResponse(newChatRes.status, ct, text)) {
      throw new Error(WAF_ERROR_MESSAGE);
    }

    if (!newChatRes.ok) {
      throw new Error(`Gagal membuat sesi chat Qwen (${newChatRes.status}): ${text.slice(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Respon inisialisasi sesi Qwen tidak valid.");
    }

    chatId = data?.data?.id || data?.id || data?.chat_id || "";
    if (!chatId) {
      throw new Error("Upstream Qwen tidak mengembalikan Chat ID.");
    }
  } catch (err) {
    if (err.message.includes("WAF") || err.message.includes("Captcha")) throw err;
    throw new Error(`Gagal inisialisasi sesi Qwen: ${err.message}`);
  }

  // ── Step 2: Send Message & Read SSE Stream ───────────────────────────────
  const completionUrl = `${CHAT_COMPLETIONS_URL}?chat_id=${chatId}`;
  const fid = crypto.randomUUID();
  const msgPayload = {
    stream: true,
    incremental_output: true,
    chat_id: chatId,
    chat_mode: "normal",
    model: modelId,
    parent_id: null,
    messages: [
      {
        fid,
        parentId: null,
        childrenIds: [],
        role: "user",
        content: prompt.trim(),
        user_action: "chat",
        files: [],
        timestamp: Math.floor(Date.now() / 1000),
        models: [modelId],
        chat_type: "t2t",
        feature_config: {
          thinking_enabled: enableThinking,
          output_schema: "phase",
          auto_thinking: enableThinking,
          research_mode: "normal",
          auto_search: false,
        },
        sub_chat_type: "t2t",
        parent_id: null,
      },
    ],
  };

  let upstream;
  try {
    upstream = await fetch(completionUrl, {
      method: "POST",
      headers: buildApiHeaders(token, cookieHeader, chatId),
      body: JSON.stringify(msgPayload),
      signal,
    });
  } catch (err) {
    throw new Error(`Gagal menghubungi Qwen upstream: ${err.message}`);
  }

  const ct = upstream.headers.get("content-type") || "";

  // Pre-check for JSON WAF challenge responses
  if (ct.includes("application/json") || ct.includes("text/html")) {
    const rawText = await upstream.text().catch(() => "");
    if (isWafResponse(upstream.status, ct, rawText)) {
      throw new Error(WAF_ERROR_MESSAGE);
    }
    if (!upstream.ok) {
      throw new Error(`Qwen upstream error (${upstream.status}): ${rawText.slice(0, 200)}`);
    }

    try {
      const json = JSON.parse(rawText);
      if (json.ret?.some?.((r) => r.includes("FAIL_SYS_USER_VALIDATE") || r.includes("RGV587_ERROR"))) {
        throw new Error(WAF_ERROR_MESSAGE);
      }
      const directContent = json.choices?.[0]?.message?.content || json.data?.choices?.[0]?.message?.content || "";
      if (directContent) {
        return {
          content: directContent.trim(),
          reasoning: "",
          model: modelId,
        };
      }
    } catch (e) {
      if (e.message.includes("WAF") || e.message.includes("Captcha")) throw e;
    }
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    if (isWafResponse(upstream.status, ct, errText)) {
      throw new Error(WAF_ERROR_MESSAGE);
    }
    throw new Error(`Qwen upstream error (${upstream.status}): ${errText.slice(0, 200)}`);
  }

  // ── Step 3: Parse SSE Stream Response ────────────────────────────────────
  const reader = upstream.body?.getReader();
  if (!reader) {
    throw new Error("Tidak ada stream body dari Qwen API.");
  }

  const decoder = new TextDecoder();
  let content = "";
  let reasoning = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (isWafResponse(200, "", line)) {
          throw new Error(WAF_ERROR_MESSAGE);
        }

        const delta = parseSseDelta(line);
        if (!delta || !delta.text) continue;

        if (delta.kind === "answer") {
          content += delta.text;
        } else if (delta.kind === "think") {
          reasoning += delta.text;
        }
      }
    }
  } catch (err) {
    if (err.message.includes("WAF") || err.message.includes("Captcha")) throw err;
    if (!content && !reasoning) {
      throw new Error(`Error saat membaca respons Qwen: ${err.message}`);
    }
  }

  const finalContent = content.trim();
  const finalReasoning = reasoning.trim();

  if (!finalContent && !finalReasoning) {
    throw new Error(WAF_ERROR_MESSAGE);
  }

  return {
    content: finalContent || "*(Tidak ada teks balasan)*",
    reasoning: finalReasoning,
    model: modelId,
  };
}
