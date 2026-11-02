const CONNECT_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 45000;
const SETTLE_MS = 2500;

export function scrapingBrowserEndpoint() {
  const direct = String(process.env.BRIGHTDATA_SCRAPING_BROWSER_WS || "").trim();
  if (direct) return direct;

  const customer = String(process.env.BRIGHTDATA_CUSTOMER || "").trim();

  const password = String(
    process.env.BRIGHTDATA_SCRAPING_BROWSER_PASSWORD ||
      process.env.BRIGHTDATA_PROXY_PASSWORD ||
      process.env.BRIGHTDATA_PASSWORD ||
      ""
  ).trim();
  const zone = String(process.env.BRIGHTDATA_SCRAPING_BROWSER_ZONE || "scraping_browser1").trim();
  if (customer && password && zone) {
    return `wss://brd-customer-${customer}-zone-${zone}:${password}@brd.superproxy.io:9222`;
  }
  return "";
}

export function remoteBrowserAvailable() {
  if (String(process.env.BRIGHTDATA_SCRAPING_BROWSER_ENABLED ?? "1").trim() === "0") return false;
  return Boolean(scrapingBrowserEndpoint());
}

async function loadPuppeteer() {
  try {
    const mod = await import("puppeteer-core");
    return mod.default || mod;
  } catch (_) {}
  try {
    const mod = await import("puppeteer");
    return mod.default || mod;
  } catch (_) {
    throw new Error("Modul 'puppeteer-core'/'puppeteer' tidak tersedia.");
  }
}

export async function connectRemoteBrowser({ timeoutMs = CONNECT_TIMEOUT_MS } = {}) {
  const endpoint = scrapingBrowserEndpoint();
  if (!endpoint) throw new Error("Endpoint BrightData Scraping Browser belum dikonfigurasi.");

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.connect({
    browserWSEndpoint: endpoint,
    defaultViewport: null,
    protocolTimeout: timeoutMs,
    timeout: timeoutMs,
  });

  const close = async () => {
    try {

      if (String(process.env.BRIGHTDATA_SCRAPING_BROWSER_CLOSE || "1").trim() !== "0") await browser.close();
      else browser.disconnect();
    } catch (_) {
      try {
        browser.disconnect();
      } catch (_) {}
    }
  };

  return { browser, close };
}

export async function remoteSolveChallenge(url, { timeoutMs = NAV_TIMEOUT_MS } = {}) {
  const { browser, close } = await connectRemoteBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    let cleared = true;
    try {
      const title = await page.title().catch(() => "");
      const html = await page.content().catch(() => "");
      const lower = `${title} ${html}`.toLowerCase();
      cleared = !(
        lower.includes("just a moment") ||
        lower.includes("checking your browser") ||
        lower.includes("cf-browser-verification") ||
        lower.includes("attention required")
      );
    } catch (_) {}

    const cookies = await page.cookies().catch(() => []);
    const content = cleared ? await page.content().catch(() => "") : "";
    const finalUrl = page.url();
    await page.close().catch(() => {});
    return { cleared, content, url: finalUrl, cookies };
  } finally {
    await close();
  }
}

export async function remoteInPageFetch(url, { method = "GET", headers = {}, body = null, form = null } = {}) {
  const { browser, close } = await connectRemoteBrowser();
  try {
    const page = await browser.newPage();
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});

    const doFetch = async () =>
      page.evaluate(
        async (target, opts) => {
          try {
            let payload;
            if (opts.form) {
              payload = new FormData();
              for (const [key, value] of Object.entries(opts.form)) {
                payload.append(key, String(value));
              }
            } else if (opts.body) {
              payload = JSON.stringify(opts.body);
            }
            const resp = await window.fetch(target, {
              method: opts.method || "GET",
              headers: opts.headers || {},
              body: payload,
              credentials: "include",
            });
            const text = await resp.text();
            let parsed = null;
            try {
              parsed = JSON.parse(text);
            } catch (_) {}
            return { ok: resp.ok, status: resp.status, data: parsed !== null ? parsed : text };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
        url,
        { method, headers, body, form }
      );

    await new Promise((r) => setTimeout(r, SETTLE_MS));
    let result = await doFetch();
    if (result && !result.ok && result.status >= 400) {
      await new Promise((r) => setTimeout(r, 3000));
      result = await doFetch();
    }

    await page.close().catch(() => {});
    if (!result || result.error) {
      throw new Error(`Remote fetch gagal: ${result?.error || "unknown"}`);
    }
    return result;
  } finally {
    await close();
  }
}

export async function remoteFetchBuffer(url, { maxBytes = 100 * 1024 * 1024, timeoutMs = NAV_TIMEOUT_MS } = {}) {
  const { browser, close } = await connectRemoteBrowser();
  try {
    const page = await browser.newPage();
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const base64 = await page.evaluate(
      async (target, limit) => {
        try {
          const resp = await window.fetch(target, { credentials: "include" });
          if (!resp.ok) return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
          const buf = await resp.arrayBuffer();
          if (buf.byteLength > limit) return { ok: false, status: resp.status, error: "file terlalu besar" };
          const bytes = new Uint8Array(buf);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          return { ok: true, status: resp.status, base64: btoa(binary), size: bytes.byteLength };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
      url,
      maxBytes
    );

    await page.close().catch(() => {});
    if (!base64?.ok) {
      throw new Error(`Remote download gagal: ${base64?.error || "unknown"}`);
    }
    return Buffer.from(base64.base64, "base64");
  } finally {
    await close();
  }
}

export default {
  scrapingBrowserEndpoint,
  remoteBrowserAvailable,
  connectRemoteBrowser,
  remoteSolveChallenge,
  remoteInPageFetch,
  remoteFetchBuffer,
};
