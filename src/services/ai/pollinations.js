const OPENAI_URL = "https://text.pollinations.ai/openai";
const TIMEOUT_MS = 30000;

const WORKING_MODEL = "openai";

export async function askPollinations(prompt, options = {}) {
  const clean = String(prompt || "").trim();
  if (!clean) throw new Error("Prompt kosong.");
  const messages = [
    {
      role: "system",
      content: options.system || "Jawab dengan bahasa yang sama seperti user, natural, singkat dan jelas.",
    },
    ...(Array.isArray(options.history) ? options.history : []),
    { role: "user", content: clean },
  ];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: WORKING_MODEL, messages }),
    signal: AbortSignal.timeout(options.timeoutMs || TIMEOUT_MS),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Pollinations HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content?.trim?.() || "";
  if (!text) throw new Error("Pollinations mengembalikan jawaban kosong.");
  return { text, model: data?.model || WORKING_MODEL, source: "pollinations" };
}

export default askPollinations;
