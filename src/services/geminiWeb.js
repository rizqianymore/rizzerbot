import puppeteer from "puppeteer";
import { settings } from "@/config/settings.js";

const GEMINI_URL = "https://gemini.google.com/app";
const GEMINI_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36";

/**
 * Parse cookie string into key-value pairs
 */
function parseCookies(raw) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) return null;
      const name = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      if (!name || !value) return null;
      return { name, value };
    })
    .filter(Boolean);
}

/**
 * Parse StreamGenerate response text from Gemini Web.
 * Extracts answer text from wrb.fr payload.
 */
export function parseStreamResponse(raw) {
  if (!raw) return "";
  const lines = raw.split("\n");
  let lastText = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === ")]}'" || /^\d+$/.test(line)) continue;
    if (!line.includes("wrb.fr")) continue;
    try {
      const arr = JSON.parse(line);
      if (!Array.isArray(arr) || !Array.isArray(arr[0]) || arr[0][0] !== "wrb.fr") continue;
      const payload = arr[0]?.[2];
      if (typeof payload !== "string") continue;
      const inner = JSON.parse(payload);
      const responseArray = inner?.[4]?.[0]?.[1];
      if (!Array.isArray(responseArray)) continue;
      const text = responseArray.filter((c) => typeof c === "string").join("");
      if (text) lastText = text;
    } catch {
      // Ignore
    }
  }
  return lastText;
}

/**
 * Parse Bard batchexecute response
 */
export function parseBatchExecuteResponse(raw) {
  if (!raw) return "";
  const lines = raw.split("\n");
  let lastText = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === ")]}'" || /^\d+$/.test(line)) continue;
    try {
      const arr = JSON.parse(line);
      if (!Array.isArray(arr) || !Array.isArray(arr[0])) continue;
      const payload = arr[0]?.[2];
      if (typeof payload !== "string") continue;
      const inner = JSON.parse(payload);
      
      // Try to find markdown / answer inside nested arrays
      const candidateArray = inner?.[4]?.[0]?.[1] || inner?.[1]?.[0] || inner?.[0];
      if (Array.isArray(candidateArray)) {
        const text = candidateArray.filter((c) => typeof c === "string").join("");
        if (text) lastText = text;
      }
    } catch {
      // Ignore
    }
  }
  return lastText;
}

/**
 * Ask Google Gemini Web via direct HTTP batchexecute API or Puppeteer automation fallback
 * @param {string} prompt
 * @param {Object} options
 * @returns {Promise<{ answer: string, model: string }>}
 */
export async function askGeminiWeb(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt pertanyaan tidak boleh kosong.");
  }

  const cookieStr = options.cookie || settings.geminiCookie || process.env.GEMINI_COOKIE;
  if (!cookieStr) {
    throw new Error(
      "Cookie Gemini Web belum dikonfigurasi di config/settings.js (geminiCookie)."
    );
  }

  // 1. Coba lewat Puppeteer untuk akurasi tinggi & handling session Google
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(GEMINI_USER_AGENT);

    const parsed = parseCookies(cookieStr);
    const cookiesToSet = parsed.map((c) => ({
      name: c.name,
      value: c.value,
      domain: ".google.com",
      path: "/",
      secure: true,
      httpOnly: false,
    }));

    if (cookiesToSet.length > 0) {
      await page.setCookie(...cookiesToSet);
    }

    let responseText = "";
    let captured = false;

    const responsePromise = new Promise((resolve) => {
      page.on("response", async (resp) => {
        try {
          const url = resp.url();
          if (!url.includes("StreamGenerate") && !url.includes("batchexecute")) return;
          if (captured) return;
          const raw = await resp.text().catch(() => "");
          const text = parseStreamResponse(raw) || parseBatchExecuteResponse(raw);
          if (text) {
            responseText = text;
            captured = true;
            resolve();
          }
        } catch (_) {
          resolve();
        }
      });
    });

    await page.goto(GEMINI_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const inputSelector = ".ql-editor, [contenteditable='true'], textarea";
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    await page.click(inputSelector);
    await page.keyboard.type(prompt.trim(), { delay: 10 });
    await new Promise((r) => setTimeout(r, 300));
    await page.keyboard.press("Enter");

    await Promise.race([
      responsePromise,
      new Promise((r) => setTimeout(r, 45000)),
    ]);

    if (!responseText) {
      try {
        const fallbackText = await page.evaluate(() => {
          const modelResponses = document.querySelectorAll(
            "model-response, .model-response-text, .response-container-content, message-content"
          );
          if (modelResponses.length > 0) {
            const last = modelResponses[modelResponses.length - 1];
            return last.innerText || last.textContent || "";
          }
          return "";
        });
        if (fallbackText && fallbackText.trim()) {
          responseText = fallbackText.trim();
        }
      } catch (_) {}
    }

    if (!responseText) {
      throw new Error(
        "Tidak ada respon dari Gemini Web. Pastikan cookie Google masih aktif dan tidak expired."
      );
    }

    return {
      status: true,
      model: "Google Gemini Web",
      answer: responseText.trim(),
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}
