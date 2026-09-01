import puppeteer from "puppeteer";
import { settings } from "@/config/settings.js";

const GROK_URL = "https://grok.com/";
const GROK_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

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
    } catch (_) {}
  }

  return (modelMessage || accumulated).trim();
}

/**
 * Tanya jawab cerdas dengan xAI Grok Web.
 * @param {string} prompt
 * @param {Object} options
 * @returns {Promise<{ answer: string, model: string }>}
 */
export async function askGrokWeb(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt pertanyaan tidak boleh kosong.");
  }

  const cookieStr = options.cookie || settings.grokCookie || process.env.GROK_COOKIE;
  if (!cookieStr) {
    throw new Error("Cookie Grok Web belum dikonfigurasi di config/settings.js (grokCookie).");
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
    await page.setUserAgent(GROK_USER_AGENT);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const cookies = parseCookies(cookieStr).map((c) => ({
      name: c.name,
      value: c.value,
      domain: ".grok.com",
      path: "/",
      secure: true,
      httpOnly: false,
    }));

    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    let responseText = "";
    let captured = false;

    // Listen to network responses from Grok streaming endpoint
    page.on("response", async (resp) => {
      try {
        const url = resp.url();
        if (
          !url.includes("/app-chat/conversations") &&
          !url.includes("/load-responses") &&
          !url.includes("/chat")
        ) {
          return;
        }

        const raw = await resp.text().catch(() => "");
        if (!raw) return;

        if (url.includes("/load-responses")) {
          try {
            const json = JSON.parse(raw);
            const assistantResp = json.responses?.find((r) => r.sender === "assistant");
            if (assistantResp && assistantResp.message) {
              responseText = assistantResp.message;
              captured = true;
              return;
            }
          } catch (_) {}
        }

        const text = parseGrokStream(raw);
        if (text && text.trim().length > 0) {
          responseText = text;
          captured = true;
        }
      } catch (_) {}
    });

    await page.goto(GROK_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait and find active chat input element
    const inputSelector = "textarea, [contenteditable='true'], .ProseMirror, input[type='text']";
    await page.waitForSelector(inputSelector, { timeout: 20000 });

    await page.click(inputSelector);
    await page.keyboard.type(prompt.trim(), { delay: 10 });
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press("Enter");

    // Wait up to 35s for response
    const startTime = Date.now();
    while (Date.now() - startTime < 35000) {
      if (captured && responseText) break;

      // Extract from DOM if available
      try {
        const domAnswer = await page.evaluate(() => {
          const blocks = document.querySelectorAll(
            ".response-message, .message-bubble, [data-testid='message-text'], .prose, .markdown"
          );
          if (blocks.length > 0) {
            const last = blocks[blocks.length - 1];
            return (last.innerText || last.textContent || "").trim();
          }
          return "";
        });

        if (domAnswer && domAnswer.length > 2) {
          responseText = domAnswer;
        }
      } catch (_) {}

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!responseText) {
      throw new Error(
        "Tidak ada respon dari Grok Web. Pastikan cookie sso/sso-rw aktif atau coba refresh sesi di grok.com."
      );
    }

    return {
      status: true,
      model: "xAI Grok",
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
