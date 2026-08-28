import crypto from "node:crypto";

const API = "https://api.overchat.ai/v1/chat/completions";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

/**
 * Tanya jawab AI Qwen3 80B via OverChat (Public & Keyless)
 */
export async function askQwen3(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Pertanyaan/prompt tidak boleh kosong.");
  }

  const chatId = options.chatId || crypto.randomUUID();
  const deviceId = options.deviceId || crypto.randomUUID();
  const model = options.model || "alibaba/qwen3-next-80b-a3b-instruct";

  const messages = [
    ...(options.history || []).map((item) => ({
      id: crypto.randomUUID(),
      role: item.role,
      content: item.content,
    })),
    {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
    },
    {
      id: crypto.randomUUID(),
      role: "system",
      content: "Ikuti bahasa user dan jawab dengan gaya natural, rapi, dan jelas.",
    },
  ];

  const body = {
    chatId,
    model,
    messages,
    personaId: "qwen-3-landing",
    frequency_penalty: 0,
    max_tokens: 4000,
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
    "user-agent": USER_AGENT,
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://overchat.ai",
    referer: "https://overchat.ai/",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    priority: "u=1, i",
  };

  const response = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OverChat API Error (${response.status}): ${text.slice(0, 200) || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Tidak ada stream body dari OverChat API.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

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
        const content = json.choices?.[0]?.delta?.content;
        if (typeof content === "string") answer += content;
      } catch (_) {}
    }
  }

  const finalAnswer = answer.trim();
  if (!finalAnswer) {
    throw new Error("Respon AI kosong dari server OverChat.");
  }

  return {
    status: true,
    model: "Qwen3 80B",
    answer: finalAnswer,
  };
}
