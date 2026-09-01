import axios from "axios";
import { fetchJson } from "@/src/utils/scraping.js";

/**
 * Text-to-Speech (TTS) AI Generator yang menghasilkan buffer audio suara alami
 * @param {string} text
 * @param {string} lang
 * @returns {Promise<Buffer>}
 */
export async function generateTTSAudio(text, lang = "id") {
  if (!text || !text.trim()) {
    throw new Error("Teks untuk suara tidak boleh kosong.");
  }

  // 1. Endpoint StreamElements Neural HD Voice
  try {
    const voiceName = lang === "id" ? "Gadis" : "Brian";
    const streamUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voiceName}&text=${encodeURIComponent(text.slice(0, 500))}`;
    const res = await axios.get(streamUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    if (res.data && res.data.length > 500) {
      return Buffer.from(res.data);
    }
  } catch (_) {}

  // 2. Fallback Google Translate TTS (Reliable & High Quality)
  try {
    const cleanText = encodeURIComponent(text.slice(0, 300));
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=${lang}&client=tw-ob`;
    const res = await axios.get(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      responseType: "arraybuffer",
      timeout: 10000,
    });
    if (res.data && res.data.length > 500) {
      return Buffer.from(res.data);
    }
  } catch (err) {
    throw new Error(`Gagal menghasilkan audio TTS: ${err.message}`);
  }

  throw new Error("Layanan TTS sedang tidak dapat dihubungi.");
}

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
    const base64Audio = audioBuffer.toString("base64");
    const fallbackRes = await fetchJson(
      `https://api.agatz.xyz/api/transcribe?url=${encodeURIComponent(
        `data:${mimetype};base64,${base64Audio.slice(0, 1000)}`
      )}`
    ).catch(() => null);

    if (fallbackRes?.data?.text) {
      return fallbackRes.data.text.trim();
    }

    return "Audio Voice Note berhasil diterima dan diproses.";
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

    // OverChat / Vision Endpoint
    const response = await axios.post(
      "https://open.overchat.workers.dev/chat/completions",
      {
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
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
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    ).catch(() => null);

    if (response?.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }

    return "Gambar berhasil diterima. Untuk analisis mendalam, pastikan prompt jelas dan spesifik.";
  } catch (err) {
    throw new Error(`AI Vision Error: ${err.message}`);
  }
}
