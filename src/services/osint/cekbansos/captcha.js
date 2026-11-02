import axios from "axios";
import { getSharp } from "@/src/utils/native.js";
import { client, UA } from "./client.js";

export const CAPTCHA_LEN = 4;
const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const clean = (t) => String(t || "").replace(/[^A-Za-z0-9]/g);

async function getOptimalThreshold(buffer) {
  const sharp = getSharp();
  if (!sharp) return 165;
  try {
    const stats = await sharp(buffer).stats();

    if (stats && stats.hasMean) {
      const mean = stats.mean.r;

      const normalized = Math.round((1 - mean / 255) * 255);

      return Math.max(0, Math.min(255, normalized + 10));
    }
    return 165;
  } catch (_) {
    return 165;
  }
}

async function preprocessCaptcha(buffer, threshold = null) {
  const sharp = getSharp();
  if (!sharp) return buffer;

  const thresh = threshold !== null ? threshold : await getOptimalThreshold(buffer);
  let pipe = sharp(buffer).grayscale().normalize().resize({ width: 480 });
  if (thresh >= 0) pipe = pipe.threshold(thresh);
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
                text: "This image shows a distorted CAPTCHA (letters and/or digits). Read it left to right. Reply with ONLY the characters, nothing else.",
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
          maxOutputTokens: 15,
        },
      },
      { timeout: 12000 }
    );
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const text = clean(raw);

    if (text.length > 0) return text;
  } catch (_) {}
  return null;
}

export async function solveCaptchaRemote(imageBuffer, engine = "2") {
  try {
    const pre = await preprocessCaptcha(imageBuffer);
    const b64 = `data:image/png;base64,${pre.toString("base64")}`;
    const body = new URLSearchParams({
      base64Image: b64,
      OCREngine: engine,
      isTable: "false",
      scale: "true",
      detectOrientation: "true",
      isOverlayRequired: "false",
    }).toString();
    const res = await client.post(OCRSPACE_URL, body, {
      headers: {
        apikey: process.env.OCRSPACE_API_KEY || "helloworld",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 15000,
    });
    const text = res.data?.ParsedResults?.[0]?.ParsedText || "";
    const cleaned = clean(text);
    return cleaned || null;
  } catch {
    return null;
  }
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

    for (const threshold of [165, 0, 200]) {
      try {
        const pre = await preprocessCaptcha(imageBuffer, threshold);
        const ret = await worker.recognize(pre);
        const text = clean(ret?.data?.text || "");
        if (text.length > 0) return text;
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

const VIA_RANK = {
  "ocrspace-e2": 0,
  "ocrspace-e1": 1,
  "gemini-ai": 2,
  "tesseract.js": 3,
};

const ENGINE_WEIGHTS = {
  "ocrspace-e2": 1.0,
  "ocrspace-e1": 0.9,
  "gemini-ai": 0.8,
  "tesseract.js": 0.6,
};

export async function solveCaptcha(imageBuffer) {
  const votes = new Map();
  const push = (g, via) => {
    const guess = clean(g);
    if (!guess) return;
    const entry = votes.get(guess) || { count: 0, vias: [], weight: 0 };
    entry.count += 1;
    entry.weight += (ENGINE_WEIGHTS[via] || 0.5);
    if (!entry.vias.includes(via)) entry.vias.push(via);
    votes.set(guess, entry);
  };

  const [ocrspace2, gemini, tesseract] = await Promise.all([
    solveCaptchaRemote(imageBuffer, "2"),
    solveCaptchaGemini(imageBuffer),
    solveCaptchaTesseractJs(imageBuffer),
  ]);

  push(ocrspace2, "ocrspace-e2");
  push(gemini, "gemini-ai");
  push(tesseract, "tesseract.js");

  if (votes.size >= 2) {
    const ranked = [...votes.entries()]
      .map(([guess, e]) => ({
        guess,
        via: e.vias[0],
        count: e.count,
        weight: e.weight,
      }))

      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.weight !== a.weight) return b.weight - a.weight;
        return (VIA_RANK[a.via] ?? 9) - (VIA_RANK[b.via] ?? 9);
      });

    const [first, ...rest] = ranked;
    const totalVotes = ranked.reduce((sum, e) => sum + e.count, 0);
    const confidence = first.count >= 2 || first.weight >= 1.5 ? "high" : "medium";

    return {
      guess: first.guess,
      via: first.via,
      alternates: rest.map(({ guess, via }) => ({ guess, via })),
      confidence: confidence,
      totalVotes,
      enginePriority: first.via,
    };
  }

  if (votes.size < 2) {
    for (const engine of ["2", "1"]) {
      const remote = await solveCaptchaRemote(imageBuffer, engine);
      if (remote && remote.length >= 3) {
        push(remote, `ocrspace-e${engine}`);
        if (votes.size >= 2) break;
      }
    }
  }

  if (votes.size > 0) {
    const ranked = [...votes.entries()]
      .map(([guess, e]) => ({
        guess,
        via: e.vias[0],
        count: e.count,
        weight: e.weight,
      }))
      .sort((a, b) => b.count - a.count || b.weight - a.weight);

    const [first] = ranked;
    return {
      guess: first.guess,
      via: first.via,
      alternates: [],
      confidence: first.count >= 2 ? "high" : "medium",
      totalVotes: first.count,
      enginePriority: first.via,
    };
  }

  return {
    guess: null,
    via: null,
    alternates: [],
    confidence: "none",
    totalVotes: 0,
    enginePriority: null,
  };
}
