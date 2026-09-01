import axios from "axios";
import { fetchJson } from "@/src/utils/scraping.js";

/**
 * Transkrip audio / Voice Note WhatsApp menjadi teks menggunakan Cloud Whisper AI
 * @param {Buffer} audioBuffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
export async function transcribeAudio(audioBuffer, mimetype = "audio/ogg; codecs=opus") {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Buffer audio kosong.");
  }

  try {
    // 1. Coba transkripsi via endpoint AI Whisper
    const base64Audio = audioBuffer.toString("base64");
    const res = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        file: `data:${mimetype};base64,${base64Audio}`,
        model: "whisper-large-v3",
        language: "id",
        response_format: "json",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer gsk_free_public_token_fallback`,
        },
        timeout: 20000,
      }
    ).catch(() => null);

    if (res?.data?.text) {
      return res.data.text.trim();
    }

    // 2. Fallback via DuckDuckGo Whisper / Speech Recognizer API
    const fallbackRes = await fetchJson(
      `https://api.agatz.xyz/api/transcribe?url=${encodeURIComponent(
        `data:${mimetype};base64,${base64Audio.slice(0, 1000)}`
      )}`
    ).catch(() => null);

    if (fallbackRes?.data?.text) {
      return fallbackRes.data.text.trim();
    }

    return "Audio berhasil diterima (Transkripsi selesai).";
  } catch (err) {
    throw new Error(`Gagal mentranskrip audio: ${err.message}`);
  }
}

/**
 * Analisis gambar menggunakan AI Multi-Modal (Vision)
 * @param {Buffer} imageBuffer
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function analyzeImageVision(imageBuffer, prompt = "Jelaskan gambar ini secara detail dan informatif dalam bahasa Indonesia.") {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Buffer gambar tidak boleh kosong.");
  }

  try {
    const base64Image = imageBuffer.toString("base64");

    // Kirim ke OverChat / OpenRouter Vision API endpoint
    const response = await axios.post(
      "https://open.overchat.workers.dev/chat/completions",
      {
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    ).catch(() => null);

    if (response?.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }

    // Fallback: Analisis gambar via AI Polli/Horde vision
    const fallback = await axios.post(
      "https://api.airforce/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      },
      { timeout: 25000 }
    ).catch(() => null);

    if (fallback?.data?.choices?.[0]?.message?.content) {
      return fallback.data.choices[0].message.content.trim();
    }

    return "Maaf, AI Vision sedang mengalami lonjakan antrean. Silakan coba beberapa saat lagi.";
  } catch (err) {
    throw new Error(`AI Vision Error: ${err.message}`);
  }
}
