import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "..", "..", "assets", "cache");
const COOKIES_CACHE_FILE = path.join(CACHE_DIR, "session_cookies.json");

/**
 * Realistic and modern device profiles for anti-bot & browser fingerprinting
 */
export const DEVICE_PROFILES = [
  {
    name: "Windows 11 Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
  },
  {
    name: "Windows 11 Edge",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    secChUa: '"Chromium";v="134", "Microsoft Edge";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1536, height: 864, isMobile: false, hasTouch: false },
  },
  {
    name: "macOS Sonoma Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
    viewport: { width: 1680, height: 1050, isMobile: false, hasTouch: false },
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 915, isMobile: true, hasTouch: true },
  },
  {
    name: "Google Pixel 8 Pro",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 892, isMobile: true, hasTouch: true },
  },
  {
    name: "iPhone 16 Pro Max",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    secChUa: null,
    secChUaMobile: "?1",
    secChUaPlatform: '"iOS"',
    viewport: { width: 440, height: 956, isMobile: true, hasTouch: true },
  },
];

export const ACCEPT_LANGUAGES = [
  "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "id-ID,id;q=0.9,en;q=0.8",
  "en-US,en;q=0.9,id;q=0.8",
  "en-GB,en;q=0.9,en-US;q=0.8,id;q=0.7",
];

export function getRandomDevice(preferredType = "any") {
  let pool = DEVICE_PROFILES;
  if (preferredType === "mobile" || preferredType === "desktop") {
    pool = DEVICE_PROFILES.filter((d) => d.type === preferredType);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildScraperHeaders(device = getRandomDevice(), customHeaders = {}) {
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
  const headers = {
    "User-Agent": device.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": lang,
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  if (device.secChUa) {
    headers["Sec-Ch-Ua"] = device.secChUa;
    headers["Sec-Ch-Ua-Mobile"] = device.secChUaMobile;
    headers["Sec-Ch-Ua-Platform"] = device.secChUaPlatform;
  }

  return { ...headers, ...customHeaders };
}

/**
 * Domain-specific cookie manager with disk persistence
 */
class CookieJar {
  constructor() {
    this.cookies = new Map(); // domain -> Map(key, value)
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(COOKIES_CACHE_FILE)) {
        const raw = fs.readFileSync(COOKIES_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        for (const [domain, jar] of Object.entries(parsed)) {
          this.cookies.set(domain, new Map(Object.entries(jar)));
        }
      }
    } catch (_) {}
  }

  _save() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const serializable = {};
      for (const [domain, jar] of this.cookies.entries()) {
        serializable[domain] = Object.fromEntries(jar.entries());
      }
      fs.writeFileSync(COOKIES_CACHE_FILE, JSON.stringify(serializable, null, 2), "utf-8");
    } catch (_) {}
  }

  getDomainKey(urlOrHost) {
    try {
      const u = new URL(urlOrHost.startsWith("http") ? urlOrHost : `https://${urlOrHost}`);
      return u.hostname.toLowerCase();
    } catch (_) {
      return String(urlOrHost).toLowerCase();
    }
  }

  setCookie(domainOrUrl, key, value) {
    const domain = this.getDomainKey(domainOrUrl);
    if (!this.cookies.has(domain)) {
      this.cookies.set(domain, new Map());
    }
    this.cookies.get(domain).set(key, value);
    this._save();
  }

  addCookiesFromHeader(domainOrUrl, setCookieHeader) {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const domain = this.getDomainKey(domainOrUrl);
    if (!this.cookies.has(domain)) {
      this.cookies.set(domain, new Map());
    }
    const jar = this.cookies.get(domain);

    for (const c of list) {
      if (typeof c !== "string") continue;
      const parts = c.split(";")[0].trim();
      const eqIdx = parts.indexOf("=");
      if (eqIdx > 0) {
        const key = parts.slice(0, eqIdx).trim();
        const val = parts.slice(eqIdx + 1).trim();
        jar.set(key, val);
      }
    }
    this._save();
  }

  getCookieString(domainOrUrl) {
    const domain = this.getDomainKey(domainOrUrl);
    const jar = this.cookies.get(domain);
    if (!jar || jar.size === 0) return "";
    return Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  clearDomain(domainOrUrl) {
    const domain = this.getDomainKey(domainOrUrl);
    this.cookies.delete(domain);
    this._save();
  }

  clearAll() {
    this.cookies.clear();
    this._save();
  }
}

export const cookieJar = new CookieJar();

/**
 * Detect Cloudflare challenge / Turnstile / Anti-Bot block
 */
export function isCloudflareChallenge(status, headers = {}, body = "") {
  if (status === 403 || status === 503 || status === 429) {
    const h = JSON.stringify(headers).toLowerCase();
    const b = (typeof body === "string" ? body : "").toLowerCase();
    if (
      h.includes("cf-ray") ||
      h.includes("cf-mitigated") ||
      h.includes("cloudflare") ||
      b.includes("just a moment...") ||
      b.includes("attention required! | cloudflare") ||
      b.includes("cf-turnstile") ||
      b.includes("cf-browser-verification") ||
      b.includes("challenges.cloudflare.com") ||
      b.includes("verifying you are human") ||
      b.includes("checking your browser")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Headless Stealth Browser Controller for Cloudflare & Anti-Bot Bypass
 */
class StealthBrowserManager {
  constructor() {
    this.browser = null;
    this.idleTimer = null;
    this.isLaunching = false;
  }

  async getBrowser() {
    this._resetIdleTimer();
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.browser && this.browser.connected) return this.browser;
    }

    this.isLaunching = true;
    try {
      const { default: puppeteer } = await import("puppeteer");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
          "--window-size=1280,800",
        ],
      });
      return this.browser;
    } finally {
      this.isLaunching = false;
    }
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    // Auto-close browser after 45 seconds of idle time to conserve memory
    this.idleTimer = setTimeout(() => {
      this.close();
    }, 45000);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  async close() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (_) {}
      this.browser = null;
    }
  }

  /**
   * Navigate with Cloudflare Turnstile / Challenge clearance
   */
  async solveChallenge(targetUrl, { timeoutMs = 25000, preferredDevice = "desktop" } = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const device = getRandomDevice(preferredDevice);

    try {
      await page.setViewport(device.viewport || { width: 1280, height: 800 });
      await page.setUserAgent(device.userAgent);

      // Stealth evasion overrides
      await page.evaluateOnNewDocument(() => {
        // Hide webdriver
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        // Fake chrome object
        window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
        // Fake plugins
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
        // Fake languages
        Object.defineProperty(navigator, "languages", {
          get: () => ["id-ID", "id", "en-US", "en"],
        });
      });

      // Attach existing domain cookies if any
      const existingCookieStr = cookieJar.getCookieString(targetUrl);
      if (existingCookieStr) {
        const u = new URL(targetUrl);
        const pairs = existingCookieStr.split("; ");
        const cookieObjects = pairs.map((pair) => {
          const [name, ...rest] = pair.split("=");
          return {
            name: name.trim(),
            value: rest.join("=").trim(),
            domain: u.hostname,
          };
        });
        await page.setCookie(...cookieObjects).catch(() => {});
      }

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Poll until Cloudflare clearance is achieved or timeout
      const startTime = Date.now();
      let cleared = false;

      while (Date.now() - startTime < timeoutMs) {
        const title = (await page.title().catch(() => "")) || "";
        const content = (await page.content().catch(() => "")) || "";

        const isChallengeTitle =
          title.includes("Just a moment...") ||
          title.includes("Attention Required! | Cloudflare") ||
          title.includes("Please Wait... | Cloudflare") ||
          title.includes("DDOS-GUARD");

        const hasTurnstile =
          content.includes("cf-turnstile") ||
          content.includes("challenges.cloudflare.com") ||
          content.includes("cf-browser-verification");

        if (!isChallengeTitle && !hasTurnstile) {
          cleared = true;
          break;
        }

        // Try to click turnstile checkbox if visible in iframe
        try {
          const frames = page.frames();
          for (const frame of frames) {
            const checkbox = await frame.$("input[type=checkbox], .cf-turnstile-wrapper, #challenge-stage");
            if (checkbox) {
              await checkbox.click().catch(() => {});
            }
          }
        } catch (_) {}

        await new Promise((r) => setTimeout(r, 600));
      }

      // Collect resolved cookies and save to jar
      const currentCookies = await page.cookies();
      for (const c of currentCookies) {
        cookieJar.setCookie(targetUrl, c.name, c.value);
      }

      // Extract result
      const pageTitle = await page.title().catch(() => "");
      const pageContent = await page.content().catch(() => "");
      const currentUrl = page.url();

      return {
        cleared,
        title: pageTitle,
        content: pageContent,
        url: currentUrl,
        cookies: currentCookies,
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Execute in-page fetch using the browser's cleared session
   */
  async inPageFetch(apiUrl, { method = "GET", headers = {}, body = null } = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const u = new URL(apiUrl);
    const origin = u.origin;

    try {
      // First ensure the origin has a cleared session
      await this.solveChallenge(origin);

      // Now open page at origin and run in-page fetch with origin credentials
      await page.goto(`${origin}/favicon.ico`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

      const result = await page.evaluate(
        async (fetchUrl, fetchOptions) => {
          try {
            const resp = await window.fetch(fetchUrl, {
              method: fetchOptions.method || "GET",
              headers: fetchOptions.headers || {},
              body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
              credentials: "include",
            });
            const text = await resp.text();
            let parsed = null;
            try {
              parsed = JSON.parse(text);
            } catch (_) {}
            return {
              ok: resp.ok,
              status: resp.status,
              statusText: resp.statusText,
              data: parsed !== null ? parsed : text,
            };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
        apiUrl,
        { method, headers, body }
      );

      if (!result.ok && result.error) {
        throw new Error(result.error);
      }
      return result.data;
    } finally {
      await page.close().catch(() => {});
    }
  }
}

export const stealthBrowser = new StealthBrowserManager();

/**
 * Universal Intelligent HTTP Request Engine with Anti-Bot & Cloudflare Bypass
 *
 * @param {string} url - Target URL
 * @param {object} [options]
 * @param {string} [options.method="GET"] - HTTP Method
 * @param {object} [options.headers] - Additional headers
 * @param {any} [options.data] - Request body (for POST/PUT)
 * @param {object} [options.params] - Query parameters
 * @param {string} [options.responseType="json"] - "json" | "text" | "buffer" | "arraybuffer"
 * @param {boolean|"auto"} [options.bypassCloudflare="auto"] - Auto bypass or force browser
 * @param {number} [options.timeout=20000] - Request timeout ms
 * @param {number} [options.retries=2] - Retry attempts on transient network errors
 * @param {string} [options.preferredDevice="any"] - "desktop" | "mobile" | "any"
 * @returns {Promise<any>}
 */
export async function smartRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const responseType = options.responseType || "json";
  const timeout = options.timeout || 20000;
  const retries = options.retries !== undefined ? options.retries : 2;
  const bypassCloudflare = options.bypassCloudflare !== undefined ? options.bypassCloudflare : "auto";
  const preferredDevice = options.preferredDevice || "any";

  const device = getRandomDevice(preferredDevice);
  const defaultHeaders = buildScraperHeaders(device);

  // Attach stored cookies
  const cookiesStr = cookieJar.getCookieString(url);
  const headers = {
    ...defaultHeaders,
    ...(cookiesStr ? { Cookie: cookiesStr } : {}),
    ...(options.headers || {}),
  };

  // If forced browser bypass is requested
  if (bypassCloudflare === true) {
    if (responseType === "json") {
      return await stealthBrowser.inPageFetch(url, {
        method,
        headers: options.headers,
        body: options.data,
      });
    }
    const solved = await stealthBrowser.solveChallenge(url, {
      timeoutMs: timeout,
      preferredDevice,
    });
    return solved.content;
  }

  // Fast HTTP Attempt
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    attempt++;
    try {
      const axiosConfig = {
        url,
        method,
        headers,
        params: options.params,
        data: options.data,
        timeout,
        responseType: responseType === "buffer" ? "arraybuffer" : responseType,
        validateStatus: () => true, // inspect all status codes
      };

      const res = await axios(axiosConfig);

      // Record any Set-Cookie headers
      if (res.headers && res.headers["set-cookie"]) {
        cookieJar.addCookiesFromHeader(url, res.headers["set-cookie"]);
      }

      // Check for Cloudflare / Anti-Bot challenge
      const isChallenge = isCloudflareChallenge(
        res.status,
        res.headers,
        typeof res.data === "string" ? res.data : ""
      );

      if (isChallenge) {
        if (bypassCloudflare === false) {
          throw new Error(`Cloudflare challenge detected (HTTP ${res.status}) and bypass is disabled.`);
        }

        // Automatic fallback to stealth browser solver
        const solved = await stealthBrowser.solveChallenge(url, {
          timeoutMs: timeout,
          preferredDevice,
        });

        if (!solved.cleared) {
          throw new Error(`Cloudflare verification failed after timeout on ${url}`);
        }

        // Retry with newly captured cf_clearance cookies
        const refreshedCookies = cookieJar.getCookieString(url);
        headers.Cookie = refreshedCookies;

        if (responseType === "json") {
          try {
            // Attempt in-page fetch for guaranteed session sharing
            return await stealthBrowser.inPageFetch(url, {
              method,
              headers: options.headers,
              body: options.data,
            });
          } catch (_) {}
        }

        const secondRes = await axios({
          ...axiosConfig,
          headers,
        });

        if (responseType === "buffer") {
          return Buffer.from(secondRes.data);
        }
        return secondRes.data;
      }

      if (res.status >= 400) {
        const errBody = typeof res.data === "object" ? JSON.stringify(res.data) : String(res.data).slice(0, 300);
        throw new Error(`HTTP ${res.status}: ${errBody}`);
      }

      if (responseType === "buffer") {
        return Buffer.from(res.data);
      }
      return res.data;
    } catch (err) {
      lastError = err;
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED" ||
        err.message?.includes("timeout");

      if (isTransient && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      break;
    }
  }

  throw lastError;
}

// Convenient shorthand methods
export const request = smartRequest;
request.get = (url, options = {}) => smartRequest(url, { ...options, method: "GET" });
request.post = (url, data, options = {}) => smartRequest(url, { ...options, method: "POST", data });
request.json = (url, options = {}) => smartRequest(url, { ...options, responseType: "json" });
request.text = (url, options = {}) => smartRequest(url, { ...options, responseType: "text" });
request.buffer = (url, options = {}) => smartRequest(url, { ...options, responseType: "buffer" });
request.browser = (url, options = {}) => smartRequest(url, { ...options, bypassCloudflare: true });
request.clearCookies = (domain) => {
  if (domain) cookieJar.clearDomain(domain);
  else cookieJar.clearAll();
};
request.closeBrowser = () => stealthBrowser.close();

export default request;
