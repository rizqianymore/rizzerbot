import axios from "axios";
import sharp from "sharp";
import { client, UA } from "./client.js";

export const CAPTCHA_LEN = 4;
const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const clean = (t) => String(t || "").replace(/[^A-Za-z0-9]/g, "");

async function preprocessCaptcha(buffer, threshold = 165) {
  let pipe = sharp(buffer).grayscale().normalize().resize({ width: 480 });
  if (threshold) pipe = pipe.threshold(threshold);
  return pipe.png().toBuffer();
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
                text: "This image shows a distorted 4-character CAPTCHA (letters and/or digits). Read it left to right. Reply with ONLY the 4 characters, nothing else.",
              },
              {
                inlineData: {
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
      { timeout: 12000 }
    );
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const text = clean(raw);
    if (text.length === CAPTCHA_LEN) return text;
  } catch (_) {}
  return null;
}

let workerPromise = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: WHITELIST,
        tessedit_pageseg_mode: "8",
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function solveCaptchaTesseractJs(imageBuffer) {
  try {
    const worker = await getWorker();
    for (const threshold of [165, 0]) {
      try {
        const pre = await preprocessCaptcha(imageBuffer, threshold);
        const ret = await worker.recognize(pre);
        const text = clean(ret?.data?.text);
        if (text.length === CAPTCHA_LEN) return text;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

let ocrStatus = null;
export async function isOcrAvailable() {
  if (ocrStatus !== null) return ocrStatus;
  try {
    await getWorker();
    ocrStatus = true;
  } catch (_) {
    ocrStatus = false;
  }
  return ocrStatus;
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
    const cleaned = clean(text);
    return cleaned || null;
  } catch {
    return null;
  }
}

const VIA_RANK = { "gemini-ai": 0, "tesseract.js": 1 };

export async function solveCaptcha(imageBuffer) {
  const votes = new Map();
  const push = (g, via) => {
    const guess = clean(g);
    if (!guess || guess.length !== CAPTCHA_LEN) return;
    const entry = votes.get(guess) || { count: 0, vias: [] };
    entry.count += 1;
    if (!entry.vias.includes(via)) entry.vias.push(via);
    votes.set(guess, entry);
  };

  const [gemini, tesseract] = await Promise.all([
    solveCaptchaGemini(imageBuffer),
    solveCaptchaTesseractJs(imageBuffer),
  ]);
  push(gemini, "gemini-ai");
  push(tesseract, "tesseract.js");

  if (votes.size < 2) {
    for (const engine of ["2", "1"]) {
      const remote = await solveCaptchaRemote(imageBuffer, engine);
      push(remote, `remote-e${engine}`);
      if (votes.size >= 2) break;
    }
  }

  if (!votes.size) return { guess: null, via: null, alternates: [], confidence: "none" };
  const ranked = [...votes.entries()]
    .map(([guess, e]) => ({ guess, via: e.vias[0], count: e.count }))
    .sort((a, b) => b.count - a.count || (VIA_RANK[a.via] ?? 9) - (VIA_RANK[b.via] ?? 9));
  const [first, ...rest] = ranked;
  return {
    guess: first.guess,
    via: first.via,
    alternates: rest.map(({ guess, via }) => ({ guess, via })),
    confidence: first.count >= 2 ? "high" : "low",
  };
}
