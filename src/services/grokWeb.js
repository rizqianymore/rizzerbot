import puppeteer from "puppeteer";
import crypto from "node:crypto";
import { settings } from "@/config/settings.js";

const GROK_CHAT_API = "https://grok.com/rest/app-chat/conversations/new";
const GROK_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

function randomString(length, alphanumeric = false) {
  const chars = alphanumeric
    ? "abcdefghijklmnopqrstuvwxyz0123456789"
    : "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateStatsigId() {
  const msg =
    Math.random() < 0.5
      ? `e:TypeError: Cannot read properties of null (reading 'children["${randomString(5, true)}"]')`
      : `e:TypeError: Cannot read properties of undefined (reading '${randomString(10)}')`;
  return Buffer.from(msg).toString("base64");
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
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
      // Skip non-JSON lines
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
  if (!cookieStr) {
    throw new Error("Cookie Grok Web belum dikonfigurasi di config/settings.js (grokCookie).");
  }

  const modeId = options.model || "fast";

  const grokPayload = {
    temporary: true,
    modeId,
    message: prompt.trim(),
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

  const traceId = randomHex(16);
  const spanId = randomHex(8);

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
      // Stealth overrides
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en", "id"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    // Parse and set existing user cookies
    const parsedCookies = cookieStr
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const eqIdx = p.indexOf("=");
        if (eqIdx === -1) return null;
        return {
          name: p.slice(0, eqIdx).trim(),
          value: p.slice(eqIdx + 1).trim(),
          domain: ".grok.com",
          path: "/",
          secure: true,
          httpOnly: false,
        };
      })
      .filter(Boolean);

    if (parsedCookies.length > 0) {
      await page.setCookie(...parsedCookies);
    }

    // Warm up page & let Cloudflare produce/refresh clearance tokens on VPS IP
    await page.goto("https://grok.com/", {
      waitUntil: "networkidle2",
      timeout: 35000,
    }).catch(async () => {
      // If networkidle2 times out, wait for domcontentloaded
      await page.goto("https://grok.com/", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    });

    await new Promise((r) => setTimeout(r, 2000));

    // Request Grok API from inside live page session
    const responsePayload = await page.evaluate(
      async (apiUrl, payload, statsigId, xaiReqId, traceparent) => {
        try {
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "*/*",
              "x-statsig-id": statsigId,
              "x-xai-request-id": xaiReqId,
              traceparent: traceparent,
            },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          return { status: res.status, text };
        } catch (e) {
          return { error: e.message };
        }
      },
      GROK_CHAT_API,
      grokPayload,
      generateStatsigId(),
      crypto.randomUUID(),
      `00-${traceId}-${spanId}-00`
    );

    if (responsePayload && responsePayload.text) {
      const parsedText = parseGrokStream(responsePayload.text);
      if (parsedText) {
        return {
          status: true,
          model: "Grok Web AI",
          answer: parsedText,
        };
      }
    }

    if (responsePayload?.status === 403) {
      throw new Error(
        "Grok Cloudflare Enterprise memblokir IP VPS (403 Forbidden). Token cf_clearance dari browser lokal tidak cocok dengan IP egress VPS."
      );
    }

    throw new Error(
      `Grok Web API mengembalikan status ${responsePayload?.status || "Unknown"}. Response: ${(responsePayload?.text || "").slice(0, 150)}`
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}
