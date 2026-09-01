import puppeteer from "puppeteer";
import crypto from "node:crypto";
import { settings } from "@/config/settings.js";

const GROK_NEW_CONVERSATION_API = "https://grok.com/rest/app-chat/conversations/new";
const GROK_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36";

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

    // Listen to network responses from Grok endpoints (conversations, load-responses)
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

        // Cek format load-responses JSON
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

        // Cek format NDJSON Stream
        const text = parseGrokStream(raw);
        if (text && text.trim().length > 0) {
          responseText = text;
          captured = true;
        }
      } catch (_) {}
    });

    await page.goto("https://grok.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Execute direct Grok new conversation request through page evaluate to inherit exact headers & cookies
    const evalResult = await page.evaluate(async (url, userPrompt) => {
      try {
        const payload = {
          temporary: true,
          modeId: "fast",
          message: userPrompt,
          fileAttachments: [],
          imageAttachments: [],
          disableSearch: false,
          enableImageGeneration: false,
          returnImageBytes: false,
          returnRawGrokInXaiRequest: false,
          enableImageStreaming: false,
          imageGenerationCount: 0,
          forceConcise: false,
          toolOverrides: {},
          enableSideBySide: true,
          sendFinalMetadata: true,
          isReasoning: false,
          disableTextFollowUps: false,
          disableMemory: true,
          forceSideBySide: false,
          isAsyncChat: false,
          disableSelfHarmShortCircuit: false,
          deviceEnvInfo: {
            darkModeEnabled: false,
            devicePixelRatio: 2,
            screenWidth: 1920,
            screenHeight: 1080,
            viewportWidth: 1920,
            viewportHeight: 1080,
          },
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "*/*",
            "x-xai-request-id": crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        return { status: res.status, text };
      } catch (err) {
        return { error: err.message };
      }
    }, GROK_NEW_CONVERSATION_API, prompt.trim());

    if (evalResult && evalResult.text) {
      const parsedStream = parseGrokStream(evalResult.text);
      if (parsedStream) {
        responseText = parsedStream;
        captured = true;
      }
    }

    // Wait up to 30s for responseText
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      if (captured && responseText) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!responseText) {
      throw new Error(
        `Grok response kosong (Status: ${evalResult?.status || "Unknown"}). Pastikan cookie sso/sso-rw aktif.`
      );
    }

    return {
      status: true,
      model: "xAI Grok-3",
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
