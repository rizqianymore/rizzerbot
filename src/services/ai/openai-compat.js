import { AI_TIMEOUT_MS, chatFetch, buildMessages, stripThink } from "./util.js";

export async function postChatCompletions({
  baseUrl,
  apiKey,
  model,
  models = [],
  messages,
  timeoutMs = AI_TIMEOUT_MS,
  extraBody = {},
  extraHeaders = {},
}) {
  const chain = [model, ...models].filter(Boolean);
  let lastErr = null;
  for (const m of [...new Set(chain)]) {
    try {
      const r = await chatFetch({
        url: `${baseUrl}/chat/completions`,
        apiKey,
        model: m,
        messages,
        extraBody,
        extraHeaders,
        timeoutMs,
      });
      return { text: stripThink(r.text), model: m, usage: r.usage };
    } catch (err) {
      lastErr = err;
      if (err?.code === "AUTH") break;
    }
  }
  throw lastErr || new Error("Semua model gagal.");
}

export { buildMessages, AI_TIMEOUT_MS };
export default postChatCompletions;
