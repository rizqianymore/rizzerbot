/**
 * Bright Data Scraping Browser (remote browser via WebSocket).
 *
 * Dipakai sebagai jalur utama bypass Cloudflare untuk modul Telkom Schools:
 * browser sungguhan berjalan di datacenter BrightData (IP bersih, tanpa
 * challenge), jadi request API bisa dilakukan dari dalam browser dengan
 * header Authorization milik siswa.
 *
 * Contoh endpoint (dari dashboard BrightData):
 *   wss://brd-customer-<CUSTOMER>-zone-scraping_browser1:<PASSWORD>@brd.superproxy.io:9222
 *
 * Konfigurasi .env (pilih salah satu):
 *   BRIGHTDATA_SCRAPING_BROWSER_WS=wss://...            (langsung)
 *   BRIGHTDATA_CUSTOMER=<CUSTOMER> + BRIGHTDATA_PROXY_PASSWORD=<PASSWORD>
 *     + BRIGHTDATA_SCRAPING_BROWSER_ZONE=scraping_browser1
 */

const CONNECT_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 45000;

/** Endpoint WebSocket remote browser (kosong bila belum dikonfigurasi). */
export function scrapingBrowserEndpoint() {
  const direct = String(process.env.BRIGHTDATA_SCRAPING_BROWSER_WS || "").trim();
  if (direct) return direct;

  const customer = String(process.env.BRIGHTDATA_CUSTOMER || "").trim();
  // Password remote browser = password zone scraping_browser1 (BEDA dari
  // password zone web_unlocker2). Fallback ke BRIGHTDATA_PROXY_PASSWORD.
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

/** Remote browser aktif? (bisa dimatikan dengan TELKOM_VIA_BRIGHTDATA_BROWSER=0) */
export function remoteBrowserEnabled() {
  if (String(process.env.TELKOM_VIA_BRIGHTDATA_BROWSER || "1").trim() === "0") return false;
  return Boolean(scrapingBrowserEndpoint());
}

/** Akhiri sesi remote setelah dipakai (hemat kuota; default: tutup). */
function shouldCloseSession() {
  return String(process.env.BRIGHTDATA_SCRAPING_BROWSER_CLOSE || "1").trim() !== "0";
}

/** Import puppeteer-core (preferred) atau puppeteer. */
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

/**
 * Sambung ke remote browser Bright Data.
 * @returns {Promise<{browser: object, close: () => Promise<void>}>}
 */
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
      if (shouldCloseSession()) await browser.close();
      else browser.disconnect();
    } catch (_) {
      try {
        browser.disconnect();
      } catch (_) {}
    }
  };

  return { browser, close };
}

/**
 * Buka halaman & tunggu Cloudflare clearance (kalau ada).
 * @returns {Promise<{cleared: boolean, content: string, url: string, cookies: object[]}>}
 */
export async function remoteSolveChallenge(url, { timeoutMs = NAV_TIMEOUT_MS } = {}) {
  const { browser, close } = await connectRemoteBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

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

/**
 * Request dari dalam browser remote (bypass CF + bisa pakai header auth).
 * `form` (object) dikirim sebagai multipart/form-data (dipakai untuk login).
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function remoteInPageFetch(url, { method = "GET", headers = {}, body = null, form = null } = {}) {
  const { browser, close } = await connectRemoteBrowser();
  try {
    const page = await browser.newPage();
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});

    const result = await page.evaluate(
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

    await page.close().catch(() => {});
    if (!result || result.error) {
      throw new Error(`Remote fetch gagal: ${result?.error || "unknown"}`);
    }
    return result;
  } finally {
    await close();
  }
}
