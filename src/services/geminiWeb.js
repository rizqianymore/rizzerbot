import puppeteer from "puppeteer";
import { settings } from "@/config/settings.js";

const GEMINI_URL = "https://gemini.google.com/app";
const GEMINI_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

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
 * Ask Google Gemini Web via Puppeteer automation
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

    // Listen only for StreamGenerate (official Gemini chat generator endpoint)
    page.on("response", async (resp) => {
      try {
        const url = resp.url();
        if (!url.includes("StreamGenerate")) return;
        const raw = await resp.text().catch(() => "");
        const text = parseStreamResponse(raw);
        if (text && text.trim().length > 0) {
          responseText = text;
          captured = true;
        }
      } catch (_) {}
    });

    await page.goto(GEMINI_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the prompt editor element
    const inputSelector = ".ql-editor, [contenteditable='true']";
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    await page.click(inputSelector);
    await page.keyboard.type(prompt.trim(), { delay: 10 });
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press("Enter");

    // Poll until responseText is captured or wait up to 35s
    const startTime = Date.now();
    while (Date.now() - startTime < 35000) {
      if (captured && responseText) break;

      // Fallback extract directly from rendered markdown response text in DOM
      try {
        const domAnswer = await page.evaluate(() => {
          const blocks = document.querySelectorAll(
            ".model-response-text, message-content, .response-container-content, model-response"
          );
          if (blocks.length > 0) {
            const last = blocks[blocks.length - 1];
            // Filter out system icons / banner texts
            const text = last.innerText || last.textContent || "";
            return text.trim();
          }
          return "";
        });

        if (domAnswer && domAnswer.length > 2 && !domAnswer.startsWith("Google Calendar")) {
          responseText = domAnswer;
        }
      } catch (_) {}

      await new Promise((r) => setTimeout(r, 1000));
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
