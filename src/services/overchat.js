import crypto from "node:crypto";

// Claude Haiku 4.5 via OverChat (https://overchat.ai) — SSE streaming.
const API = "https://api.overchat.ai/v1/chat/completions";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 90000;

/**
 * Tanya Claude Haiku.
 * @param {string} prompt
 * @param {object} [options] - { chatId, deviceId, history: [{role, content}], model, maxTokens }
 * @returns {Promise<{status: true, code, question, chatId, deviceId, responseId, model, answer} | {status: false, code, error}>}
 */
export async function ClaudeHaiku(prompt, options = {}) {
  if (!prompt || !String(prompt).trim()) {
    return { status: false, code: 400, error: "Prompt kosong." };
  }

  const chatId = options.chatId || crypto.randomUUID();
  const deviceId = options.deviceId || crypto.randomUUID();
  const model = options.model || DEFAULT_MODEL;

  const messages = [
    ...(options.history || []).map((item) => ({
      id: crypto.randomUUID(),
      role: item.role,
      content: item.content,
    })),
    {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    },
    {
      id: crypto.randomUUID(),
      role: "system",
      content: "Ikuti bahasa user dan jawab dengan gaya natural, singkat, dan jelas.",
    },
  ];

  const body = {
    chatId,
    model,
    messages,
    personaId: "claude-haiku-4-5-landing",
    frequency_penalty: 0,
    max_tokens: options.maxTokens || 4000,
    presence_penalty: 0,
    stream: true,
    temperature: 0.5,
    top_p: 0.95,
  };

  const headers = {
    "sec-ch-ua-platform": `"Android"`,
    "x-device-uuid": deviceId,
    "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
    "sec-ch-ua-mobile": "?1",
    "x-device-language": "id-ID",
    "x-device-platform": "web",
    "x-device-version": "1.0.44",
    "user-agent": UA,
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://overchat.ai",
    referer: "https://overchat.ai/",
    "accept-language": "id-ID,id;q=0.9",
    priority: "u=1, i",
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { status: false, code: response.status, error: text.slice(0, 300) || `HTTP ${response.status}` };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let answer = "";
    let responseId = null;
    let responseModel = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);
          if (typeof json.id === "string") responseId = json.id;
          if (typeof json.model === "string") responseModel = json.model;

          const content = json.choices?.[0]?.delta?.content;
          if (typeof content === "string") answer += content;
        } catch {}
      }
    }

    if (!answer.trim()) {
      return { status: false, code: response.status, error: "OverChat mengembalikan jawaban kosong." };
    }

    return {
      status: true,
      code: response.status,
      question: prompt,
      chatId,
      deviceId,
      responseId,
      model: responseModel || model,
      answer,
    };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return { status: false, code: aborted ? 408 : 0, error: aborted ? "Timeout 90 detik." : (err?.message || "Fetch gagal.") };
  } finally {
    clearTimeout(timer);
  }
}

export default ClaudeHaiku;
