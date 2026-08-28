/**
 * Ultimate Qwen AI & Scraper Service
 * Support ALL Qwen Models (Coder, Max, Plus, Flash, Vision, Thinking)
 */

export const DEFAULT_COOKIE = `cna=ioHkItBCshcCASRGg+JB54D4; qwen-locale=id-ID; qwen-theme=dark; cnaui=c18e6646-ec01-4385-986e-42bc2acfb560; aui=c18e6646-ec01-4385-986e-42bc2acfb560; qwen-thinking_mode=Fast; x-ap=ap-southeast-1; sca=a7b2a647; acw_tc=0a06abd817878991321433293e6c97b438bc4ab37e13e031bfe627c8bb697f; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImMxOGU2NjQ2LWVjMDEtNDM4NS05ODZlLTQyYmMyYWNmYjU2MCIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzgzNjQ3ODc4LCJleHAiOjE3OTA0OTExMzV9.11-RnW-nR-dgTw4rurU3KXiCTFiLn5Zfz6OI2xM0v_A; atpsida=59749b84124bd6cada275be5_1787899135_1; isg=BBMTR1kKfatg3jEzJuqhVLzTopc9yKeKPMGv18UwIjJpRDLmTZ292g-CeKoqZP-C; ssxmod_itna=1-QqUxn7e7qDwbGCDhx_x4QwDYqGq5WuvKG7DzxC5iOwDuExjKidDRDBRi6pFoPxHeqKuQ0D4q4pI2qDsW/W4i88_xYoDea3IhOQBZG25vW8td4pbKAQkoevdTXUZvpQAVIRD9WWCNUMS1EeDHxPDU=Gbfa4DxxGTDCeDQxirDD4DAjYD=OPDjWgIFaoDbohKED0kPzoDWEoDEWgwDYveDD5DAxPDw24IQDDzxPnzCirjFxcjEjdDn=GaWirpD75dDlc5Huip9_69QlEaidZLdZYfA40OD0F3abahMFqIh/8bKjnipeY5pQ5zAD5GDrKG4QD87Gxinxo4bC4xDuNY05KDNByPM_I07HSb8WioiySC5lmH=3hVI27fTzKuO30Q805W0NG0PMr=qRiI2DYBVGDetYxI25bWbjObFqqh05445QDDVHKdh=w2OSADD; ssxmod_itna2=1-QqUxn7e7qDwbGCDhx_x4QwDYqGq5WuvKG7DzxC5iOwDuExjKidDRDBRi6pFoPxHeqKuQ0D4q4pIa4iTp7WRonANsbhvNG4=QkDeqTxuiD`;

export const QWEN_BASE = "https://chat.qwen.ai";
export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Daftar Pemetaan Model Qwen
 */
export const QWEN_MODELS = {
  // Plus & Coder Models
  plus: "qwen3.7-plus",
  "qwen-plus": "qwen3.7-plus",
  "qwen3.7-plus": "qwen3.7-plus",
  "qwen3.6-plus": "qwen3.6-plus",
  "qwen3.5-plus": "qwen3.5-plus",
  "qwen3.5-omni-plus": "qwen3.5-omni-plus",
  coder: "qwen3.7-plus",
  "coder-plus": "qwen3.7-plus",
  "coder-flash": "qwen3.6-plus",
  "qwen3-coder-plus": "qwen3.7-plus",
  "qwen3-coder-flash": "qwen3.6-plus",
  "qwen2.5-coder-32b": "qwen3.7-plus",

  // Max & Thinking Models
  max: "qwen3.8-max",
  "qwen-max": "qwen3.8-max",
  "qwen3.8-max": "qwen3.8-max",
  "qwen3.7-max": "qwen3.7-max",
  turbo: "qwen3.7-plus",
  "qwen-turbo": "qwen3.7-plus",
  "qwen2.5-72b": "qwen3.8-max",
  "qwen-deepthink": "qwen3.8-max",

  // Vision
  vision: "qwen3.5-omni-plus",
  "qwen-vl": "qwen3.5-omni-plus",
  "qwen-vl-max": "qwen3.5-omni-plus",
};

/**
 * Ekstraksi token dari string cookie
 */
export function extractToken(cookie) {
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : cookie;
}

/**
 * Normalisasi Model Target
 */
export function resolveModel(inputModel) {
  if (!inputModel) return "qwen3.7-plus";
  const key = inputModel.toLowerCase().trim();
  return QWEN_MODELS[key] || inputModel;
}

/**
 * Buat Header Request Terstandarisasi
 */
export function buildHeaders(cookie) {
  const token = extractToken(cookie);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Cookie: cookie,
    "User-Agent": USER_AGENT,
    Origin: QWEN_BASE,
    Referer: `${QWEN_BASE}/`,
    "X-DashScope-CacheControl": "enable",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Accept: "text/event-stream, application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  };
}

/**
 * 1. Buat / Dapatkan Chat ID Baru
 */
export async function createChatSession(cookie, model) {
  try {
    const res = await fetch(`${QWEN_BASE}/api/v2/chats/new`, {
      method: "POST",
      headers: buildHeaders(cookie),
      body: JSON.stringify({
        model: model,
        title: "Session " + new Date().toISOString(),
      }),
    });

    if (!res.ok) return "chat_" + Math.random().toString(36).substring(2, 12);
    const data = await res.json();
    return data.chat_id || data.id || data.data?.id || ("chat_" + Date.now());
  } catch {
    return "chat_" + Date.now();
  }
}

/**
 * 2. Fungsi Utama Request ke Qwen AI (Streaming & Non-Streaming)
 */
export async function askQwen({
  prompt,
  messages,
  cookie = process.env.QWEN_COOKIE || DEFAULT_COOKIE,
  model = "qwen3.7-plus",
  includeThinking = false,
  systemPrompt = "You are an expert full-stack developer and AI assistant powered by Qwen.",
}) {
  const targetModel = resolveModel(model);
  const chatId = "chat_" + Date.now();

  // Susun format messages
  let reqMessages = [];
  if (systemPrompt) {
    reqMessages.push({ role: "system", content: systemPrompt });
  }

  if (Array.isArray(messages) && messages.length > 0) {
    reqMessages.push(...messages);
  } else if (prompt) {
    reqMessages.push({ role: "user", content: String(prompt) });
  } else {
    throw new Error("Prompt atau messages tidak boleh kosong.");
  }

  const headers = buildHeaders(cookie);
  headers.Referer = `${QWEN_BASE}/c/${chatId}`;

  const payload = {
    chat_id: chatId,
    model: targetModel,
    stream: true,
    messages: reqMessages,
  };

  const response = await fetch(`${QWEN_BASE}/api/v2/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Qwen API Error (${response.status}): ${errBody || response.statusText}`);
  }

  // Parse SSE Stream Response
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let reasoningContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        // Cek jika terkena Anti-Bot / WAF Captcha Challenge
        if (trimmed.includes("FAIL_SYS_USER_VALIDATE") || trimmed.includes("RGV587_ERROR") || trimmed.includes("x5secdata")) {
          throw new Error("Sesi Qwen Cookie kedaluwarsa atau terkena verifikasi Captcha Alibaba (x5sec). Silakan update QWEN_COOKIE terbaru dari browser.");
        }

        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") break;

          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta || {};

            if (delta.content) {
              fullContent += delta.content;
            }
            if (delta.reasoning_content) {
              reasoningContent += delta.reasoning_content;
            }
          } catch {
            // chunk non-json di-skip
          }
        }
      }
    }

    if (fullContent.trim()) {
      if (includeThinking && reasoningContent.trim()) {
        return `💭 *Thinking Process:*\n_${reasoningContent.trim()}_\n\n*Jawaban:*\n${fullContent.trim()}`;
      }
      return fullContent.trim();
    }
  }

  // Direct JSON Fallback
  const resJson = await response.json().catch(() => null);
  if (resJson) {
    if (resJson.ret?.includes("FAIL_SYS_USER_VALIDATE") || resJson.data?.url?.includes("x5secdata")) {
      throw new Error("Sesi Qwen Cookie kedaluwarsa atau terkena verifikasi Captcha Alibaba (x5sec). Silakan update QWEN_COOKIE terbaru dari browser.");
    }
    return (
      resJson.choices?.[0]?.message?.content ||
      resJson.data?.choices?.[0]?.message?.content ||
      resJson.content ||
      "Berhasil memproses, tetapi tidak ada text balasan."
    );
  }

  throw new Error("Respon Qwen kosong atau cookie sesi perlu diperbarui.");
}
