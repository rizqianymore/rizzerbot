import puppeteer from "puppeteer";
import { settings } from "@/config/settings.js";

const GROK_URL = "https://grok.com/";
const GROK_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

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
 * Parse Grok NDJSON stream response
 */
export function parseGrokStream(raw) {
  if (!raw) return "";
  const lines = raw.split("\n");
  let accumulated = "";
  let modelMessage = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const json = JSON.parse(trimmed);
      const resp = json.result?.response;
      if (!resp) continue;

      if (resp.token && typeof resp.token === "string") {
        accumulated += resp.token;
      }
      if (resp.modelResponse?.message && typeof resp.modelResponse.message === "string") {
        modelMessage = resp.modelResponse.message;
      }
    } catch (_) {
      // Skip non-JSON chunks
    }
  }

  return (modelMessage || accumulated).trim();
}

/**
 * Tanya jawab cerdas dengan Grok AI via Grok Web.
 * @param {string} prompt
 * @param {Object} options
 * @returns {Promise<{ answer: string, model: string }>}
 */
export async function askGrokWeb(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt pertanyaan tidak boleh kosong.");
  }

  const cookieStr = options.cookie || settings.grokCookie || process.env.GROK_COOKIE;
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
    await page.setUserAgent(GROK_USER_AGENT);

    // Bypass webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    if (cookieStr) {
      const parsed = parseCookies(cookieStr);
      const cookiesToSet = parsed.map((c) => ({
        name: c.name,
        value: c.value,
        domain: ".grok.com",
        path: "/",
        secure: true,
        httpOnly: false,
      }));
      if (cookiesToSet.length > 0) {
        await page.setCookie(...cookiesToSet);
      }
    }

    let responseText = "";
    let captured = false;

    // Listen to network responses for Grok conversation/chat endpoint
    page.on("response", async (resp) => {
      try {
        const url = resp.url();
        if (!url.includes("/app-chat/conversations") && !url.includes("/chat")) return;
        const raw = await resp.text().catch(() => "");
        const text = parseGrokStream(raw);
        if (text && text.trim().length > 0) {
          responseText = text;
          captured = true;
        }
      } catch (_) {}
    });

    await page.goto(GROK_URL, {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    // Wait for input textarea/contenteditable on grok.com
    const inputSelector = "textarea, [contenteditable='true'], input[type='text'], .ProseMirror";
    await page.waitForSelector(inputSelector, { timeout: 20000 });

    await page.click(inputSelector);
    await page.keyboard.type(prompt.trim(), { delay: 10 });
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press("Enter");

    // Wait for response up to 45s
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      if (captured && responseText) break;

      // Fallback: ambil text dari bubble message DOM jika network stream tertutup
      try {
        const domAnswer = await page.evaluate(() => {
          const blocks = document.querySelectorAll(
            ".message-bubble, .response-message, [data-testid='message-text'], .prose, .markdown"
          );
          if (blocks.length > 0) {
            const last = blocks[blocks.length - 1];
            const text = last.innerText || last.textContent || "";
            return text.trim();
          }
          return "";
        });

        if (domAnswer && domAnswer.length > 3) {
          responseText = domAnswer;
        }
      } catch (_) {}

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!responseText) {
      throw new Error(
        "Tidak ada respon dari Grok Web. Pastikan cookie Grok (sso, sso-rw, cf_clearance) masih fresh dan valid."
      );
    }

    return {
      status: true,
      model: "Grok Web AI",
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
