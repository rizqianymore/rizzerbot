const API_VERSION = "v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const TIMEOUT_MS = 45000;

function apiKey() {
  return process.env.GEMINI_API_KEY || "";
}

export async function askGemini(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const key = options.apiKey || apiKey();
  if (!key) throw new Error("GEMINI_API_KEY belum diisi di .env.");
  const model = options.model || DEFAULT_MODEL;
  const system =
    options.system || "Jawab dengan bahasa yang sama seperti user, natural, singkat dan jelas.";

  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: clean }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 2048,
      },
    }),
    signal: AbortSignal.timeout(options.timeoutMs || TIMEOUT_MS),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => null);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error("Gemini mengembalikan jawaban kosong.");
  return { text, model, source: "gemini" };
}

export function isGeminiConfigured() {
  return Boolean(apiKey());
}

export default askGemini;
