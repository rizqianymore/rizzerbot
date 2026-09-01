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
      return {
        name: part.substring(0, eqIdx).trim(),
        value: part.substring(eqIdx + 1).trim(),
      };
    })
    .filter(Boolean);
}

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
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
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

    // Tunggu halaman siap dan deteksi elemen input secara dinamis
    await new Promise((r) => setTimeout(r, 2000));

    const inputFound = await page.evaluate(() => {
      const el =
        document.querySelector("textarea") ||
        document.querySelector("[contenteditable='true']") ||
        document.querySelector(".ProseMirror") ||
        document.querySelector("input[type='text']");
      if (el) {
        el.focus();
        return true;
      }
      return false;
    });

    if (!inputFound) {
      // Coba klik tombol new chat jika ada
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, a"));
        const newChat = buttons.find(
          (b) => b.textContent.includes("Chat") || b.textContent.includes("New")
        );
        if (newChat) newChat.click();
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Ketik pesan ke keyboard aktif
    await page.keyboard.type(prompt.trim(), { delay: 15 });
    await new Promise((r) => setTimeout(r, 400));
    await page.keyboard.press("Enter");

    // Tunggu respons selama 35 detik
    const startTime = Date.now();
    while (Date.now() - startTime < 35000) {
      if (captured && responseText) break;

      try {
        const domAnswer = await page.evaluate(() => {
          const blocks = document.querySelectorAll(
            ".response-message, .message-bubble, [data-testid='message-text'], .prose, .markdown, model-response"
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
        "Tidak ada respon dari Grok Web. Halaman mungkin menampilkan Cloudflare challenge pada IP server."
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
