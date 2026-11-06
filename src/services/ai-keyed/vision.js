import { isGeminiConfigured } from "./gemini.js";

const API_VERSION = "v1beta";
const DEFAULT_VISION_MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 60000;

function apiKey() {
  return process.env.GEMINI_API_KEY || "";
}

/**
 * Analisis gambar multi-modal dengan Gemini Vision
 * @param {Buffer} imageBuffer
 * @param {string} prompt
 * @param {string} [mimeType="image/jpeg"]
 * @returns {Promise<string>}
 */
export async function askGeminiVision(imageBuffer, prompt, mimeType = "image/jpeg") {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Buffer gambar tidak boleh kosong.");
  }

  const key = apiKey();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi di config/settings.js untuk menjalankan AI Vision."
    );
  }

  const cleanPrompt =
    String(prompt || "").trim() ||
    "Jelaskan gambar ini secara detail, akurat, dan informatif dalam bahasa Indonesia.";

  const base64Data = imageBuffer.toString("base64");
  const model = DEFAULT_VISION_MODEL;

  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: cleanPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini Vision HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini Vision tidak menghasilkan teks respons.");
  }

  return text;
}

export { isGeminiConfigured };
export default askGeminiVision;
