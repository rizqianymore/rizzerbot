import crypto from "node:crypto";

const BASE_URL = "https://notrack.ai";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36";

export const AVAILABLE_MODELS = [
  { id: "C", name: "Claude 3.5 Sonnet / Default", desc: "Speaker C" },
  { id: "O", name: "GPT-4o / Speaker O", desc: "Speaker O" },
  { id: "D", name: "DeepSeek / Speaker D", desc: "Speaker D" },
  { id: "G", name: "Gemini / Speaker G", desc: "Speaker G" },
];

/**
 * Tanya jawab AI dengan notrack.ai
 * @param {string} prompt
 * @param {object} [options]
 */
export async function askNoTrackAI(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt tidak boleh kosong.");
  }

  const uid = options.uid || crypto.randomUUID();
  const model = options.model || "C";
  const mode = options.mode || "usual";
  const persona = options.persona || "normal";
  const chatId = options.chatId || null;

  const payload = {
    user_input: prompt.trim(),
    mode,
    model,
    persona,
    max_turns: options.maxTurns || 6,
    chat_id: chatId,
    attachments: options.attachments || [],
    regenerate: false,
    edit: false,
    edit_mid: null,
  };

  const headers = {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    Accept: "*/*",
    Origin: BASE_URL,
    Referer: `${BASE_URL}/chat`,
    Cookie: `uid=${uid}`,
    "sec-ch-ua": '"Chromium";v="152", "Not?A_Brand";v="24", "Brave";v="152"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    priority: "u=1, i",
  };

  const response = await fetch(`${BASE_URL}/api/dispatch`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `NoTrack AI Error (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Tidak dapat membaca stream data dari NoTrack AI.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let receivedChatId = null;
  let thinking = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      try {
        const json = JSON.parse(dataStr);
        if (json.type === "chat_meta" && json.chat_id) {
          receivedChatId = json.chat_id;
        } else if (json.type === "delta" && json.chunk) {
          answer += json.chunk;
        } else if (json.type === "message" && json.content) {
          answer = json.content;
        } else if (json.type === "thinking_delta" && json.chunk) {
          thinking += json.chunk;
        }
      } catch (_) {}
    }
  }

  const finalAnswer = answer.trim();
  if (!finalAnswer) {
    throw new Error("Respon kosong diterima dari NoTrack AI.");
  }

  return {
    status: true,
    answer: finalAnswer,
    thinking: thinking.trim(),
    chatId: receivedChatId,
    uid,
  };
}
