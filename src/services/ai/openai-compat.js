export async function postChatCompletions({
  baseUrl,
  apiKey,
  model,
  models = [],
  messages,
  timeoutMs = 45000,
  extraBody = {},
  extraHeaders = {},
}) {
  const chain = [model, ...models].filter(Boolean);
  let lastErr = null;
  for (const m of [...new Set(chain)]) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
        body: JSON.stringify({ model: m, messages, ...extraBody }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 150)}`);
      }
      const data = await res.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content?.trim?.() || "";
      if (!text) throw new Error("Respons kosong.");
      return { text, model: m };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Semua model gagal.");
}

export function buildMessages(prompt, options = {}) {
  return [
    {
      role: "system",
      content: options.system || "Jawab dengan bahasa yang sama seperti user, natural, singkat dan jelas.",
    },
    ...(Array.isArray(options.history) ? options.history : []),
    { role: "user", content: String(prompt).trim() },
  ];
}
