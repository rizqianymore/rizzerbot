import { cookieJar } from "./cookies.js";
import { getRandomDevice } from "./devices.js";
import { StealthBrowserCore } from "./browser-core.js";

export class StealthBrowserManager extends StealthBrowserCore {
  async solveChallenge(targetUrl, { timeoutMs = 25000, preferredDevice = "desktop" } = {}) {
    const page = await this.newPage();
    const device = getRandomDevice(preferredDevice);

    try {
      await page.setViewport(device.viewport || { width: 1280, height: 800 });
      await page.setUserAgent(device.userAgent);

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });

        window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };

        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, "languages", {
          get: () => ["id-ID", "id", "en-US", "en"],
        });
      });

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

      const currentCookies = await page.cookies();
      for (const c of currentCookies) {
        cookieJar.setCookie(targetUrl, c.name, c.value);
      }

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
      await this.closePage(page);
    }
  }

  async inPageFetch(apiUrl, { method = "GET", headers = {}, body = null } = {}) {
    const page = await this.newPage();
    const u = new URL(apiUrl);
    const origin = u.origin;

    try {
      await this.solveChallenge(origin);

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
      await this.closePage(page);
    }
  }
}

export const stealthBrowser = new StealthBrowserManager();
