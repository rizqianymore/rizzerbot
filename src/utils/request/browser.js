import { cookieJar } from "./cookies.js";
import { getRandomDevice } from "./devices.js";
import { StealthBrowserCore } from "./browser-core.js";
import { waitForClearance, findCustomHandler } from "./protection.js";

export class StealthBrowserManager extends StealthBrowserCore {
  async preparePage(page, device) {
    const d = device || getRandomDevice("desktop");
    await page.setViewport(d.viewport || { width: 1280, height: 800 });
    await page.setUserAgent(d.userAgent);
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
    return d;
  }

  restoreCookies(page, targetUrl) {
    return (async () => {
      const existingCookieStr = cookieJar.getCookieString(targetUrl);
      if (!existingCookieStr) return;
      const u = new URL(targetUrl);
      const cookieObjects = existingCookieStr.split("; ").map((pair) => {
        const [name, ...rest] = pair.split("=");
        return { name: name.trim(), value: rest.join("=").trim(), domain: u.hostname };
      });
      await page.setCookie(...cookieObjects).catch(() => {});
    })();
  }

  persistCookies(page, targetUrl) {
    return (async () => {
      const currentCookies = await page.cookies().catch(() => []);
      for (const c of currentCookies) {
        cookieJar.setCookie(targetUrl, c.name, c.value);
      }
      return currentCookies;
    })();
  }

  async solveChallengeOnPage(page, targetUrl, { timeoutMs = 25000, preferredDevice = "desktop" } = {}) {
    const device = getRandomDevice(preferredDevice);
    await this.preparePage(page, device);
    await this.restoreCookies(page, targetUrl);

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const custom = findCustomHandler(new URL(targetUrl).hostname);
    if (custom) {
      try {
        const handled = await custom.handler(page, targetUrl);
        if (handled) {
          const cookies = await this.persistCookies(page, targetUrl);
          return {
            cleared: true,
            custom: true,
            title: await page.title().catch(() => ""),
            content: await page.content().catch(() => ""),
            url: page.url(),
            cookies,
          };
        }
      } catch (_) {}
    }

    const verdict = await waitForClearance(page, { timeoutMs });
    const cookies = await this.persistCookies(page, targetUrl);

    return {
      cleared: verdict.cleared,
      custom: false,
      type: verdict.type,
      title: await page.title().catch(() => ""),
      content: verdict.cleared ? await page.content().catch(() => "") : "",
      url: page.url(),
      cookies,
    };
  }

  async solveChallenge(targetUrl, { timeoutMs = 25000, preferredDevice = "desktop" } = {}) {
    const page = await this.newPage();
    try {
      return await this.solveChallengeOnPage(page, targetUrl, { timeoutMs, preferredDevice });
    } finally {
      await this.closePage(page);
    }
  }

  async inPageFetch(apiUrl, { method = "GET", headers = {}, body = null } = {}) {
    const page = await this.newPage();
    const u = new URL(apiUrl);
    const origin = u.origin;

    try {
      await this.solveChallengeOnPage(page, origin, { timeoutMs: 25000 });

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
