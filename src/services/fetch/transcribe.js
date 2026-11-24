import { db } from "@/src/core/database.js";

function getApiKey(name) {
  const settings = db.getSettings?.() || {};
  const env = settings.env || {};
  return process.env[name] || env[name] || "";
}

export async function transcribeWithGroq(buffer, filename = "audio.mp3", lang = "id") {
  const apiKey = getApiKey("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY belum dikonfigurasi.");

  const form = new FormData();
  form.append("file", new Blob([buffer]), filename);
  form.append("model", "whisper-large-v3");
  if (lang) form.append("language", lang);
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq Whisper error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return {
    text: data.text?.trim() || "",
    duration: data.duration || null,
    language: data.language || lang,
    source: "groq-whisper-v3",
  };
}

export async function transcribeWithGemini(buffer, mimeType = "audio/mp3") {
  const apiKey = getApiKey("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi.");

  const model = getApiKey("GEMINI_MODEL") || "gemini-2.0-flash";
  const b64 = Buffer.isBuffer(buffer) ? buffer.toString("base64") : "";
  if (!b64) throw new Error("Audio buffer kosong.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: b64,
              },
            },
            {
              text: "Tolong transkripsikan audio atau pesan suara ini menjadi teks kata demi kata secara akurat dan bersih tanpa menambahkan opini atau komentar lain. Tuliskan hanya hasil transkripsi bicaranya.",
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini Transcribe error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => p.text || "")
    .join("")
    .trim();

  return {
    text,
    source: `gemini-${model}`,
  };
}

export async function smartTranscribe(buffer, { filename = "audio.mp3", mimeType = "audio/mp3", lang = "id" } = {}) {
  const errors = [];

  try {
    return await transcribeWithGroq(buffer, filename, lang);
  } catch (err) {
    errors.push(`Groq: ${err.message}`);
  }

  try {
    return await transcribeWithGemini(buffer, mimeType);
  } catch (err) {
    errors.push(`Gemini: ${err.message}`);
  }

  throw new Error(
    `Fitur transkripsi suara membutuhkan API Key AI (GROQ_API_KEY atau GEMINI_API_KEY).\n\n` +
      `Detail error: ${errors.join(" | ")}`
  );
}
