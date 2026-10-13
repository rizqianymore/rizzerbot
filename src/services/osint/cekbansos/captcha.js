import axios from "axios";
import sharp from "sharp";
import { client, UA } from "./client.js";

async function preprocessCaptcha(buffer) {
  return sharp(buffer).grayscale().normalize().resize({ width: 480 }).threshold(165).png().toBuffer();
}

export async function solveCaptchaGemini(imageBuffer) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  try {
    const b64 = Buffer.isBuffer(imageBuffer) ? imageBuffer.toString("base64") : String(imageBuffer);
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: "Analyze this image containing a distorted 4-character CAPTCHA text. Output ONLY the 4 characters, in exact order, with no spaces, punctuation, or explanations.",
              },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: b64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        },
      },
      { timeout: 8000 }
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.replace(/[^a-zA-Z0-9]/g, "");
    if (text && text.length === 4) return text;
  } catch (_) {}
  return null;
}

export async function solveCaptchaTesseractJs(imageBuffer) {
  try {
    const { createWorker } = await import("tesseract.js");
    const pre = await preprocessCaptcha(imageBuffer);
    const worker = await createWorker("eng");
    const ret = await worker.recognize(pre);
    await worker.terminate();
    const clean = ret?.data?.text?.trim()?.replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch (_) {
    return null;
  }
}

export async function isOcrAvailable() {
  return true;
}

const OCRSPACE_URL = "https://api.ocr.space/parse/image";

export async function solveCaptchaRemote(imageBuffer, engine = "2") {
  try {
    const pre = await preprocessCaptcha(imageBuffer);
    const b64 = `data:image/png;base64,${pre.toString("base64")}`;
    const body = new URLSearchParams({
      base64Image: b64,
      OCREngine: engine,
      isTable: "false",
      scale: "true",
      detectOrientation: "false",
      isOverlayRequired: "false",
    }).toString();
    const res = await client.post(OCRSPACE_URL, body, {
      headers: {
        apikey: process.env.OCRSPACE_API_KEY || "helloworld",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 12000,
    });
    const text = res.data?.ParsedResults?.[0]?.ParsedText || "";
    const clean = String(text).replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch {
    return null;
  }
}

export async function solveCaptcha(imageBuffer) {
  const candidates = [];
  const push = (g, via) => {
    const clean = String(g || "").replace(/[^A-Za-z0-9]/g, "");
    if (clean && !candidates.some((c) => c.guess === clean)) candidates.push({ guess: clean, via });
  };

  // 1. Gemini Vision AI (highest accuracy)
  const gemini = await solveCaptchaGemini(imageBuffer);
  if (gemini) push(gemini, "gemini-ai");

  // 2. Pure JS / WASM Tesseract.js (runs locally everywhere)
  const tesseract = await solveCaptchaTesseractJs(imageBuffer);
  if (tesseract) push(tesseract, "tesseract.js");

  // 3. Remote OCR.space fallback
  for (const engine of ["2", "1"]) {
    const remote = await solveCaptchaRemote(imageBuffer, engine);
    if (remote) push(remote, `remote-e${engine}`);
    if (candidates.length >= 2) break;
  }

  candidates.sort((a, b) => Number(b.guess.length === 4) - Number(a.guess.length === 4));
  if (!candidates.length) return { guess: null, via: null, alternates: [] };
  const [first, ...rest] = candidates;
  return { guess: first.guess, via: first.via, alternates: rest };
}
