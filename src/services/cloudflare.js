/**
 * Cloudflare Turnstile & Challenge Solver Module
 * Menggunakan headless browser (Puppeteer) dengan masking anti-bot detection
 */
import puppeteer from "puppeteer";

/**
 * Solve / bypass Cloudflare Turnstile atau halaman proteksi Cloudflare
 * @param {string} targetUrl - URL yang ingin di-bypass
 * @param {Object} options
 * @param {number} [options.timeout=45000] - Timeout dalam ms
 * @param {boolean} [options.autoSubmit=true] - Otomatis submit form jika ada button turnstile
 * @param {string} [options.waitForSelector] - Tunggu selector tertentu muncul
 * @returns {Promise<{pageContent: string, finalUrl: string, cookies: any[], turnstileToken?: string}>}
 */
export async function solveCloudflare(targetUrl, options = {}) {
  const {
    timeout = 45000,
    autoSubmit = true,
    waitForSelector = null,
  } = options;

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Mask webdriver dan navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en", "id"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout,
    });

    const startTime = Date.now();

    // Loop pengecekan Cloudflare challenge / Turnstile
    let turnstileToken = null;
    while (Date.now() - startTime < timeout) {
      const title = await page.title();
      const content = await page.content();

      // Cek apakah ada Cloudflare "Just a moment..." challenge iframe
      const isCloudflareTitle = /just a moment|security check|cloudflare/i.test(title);

      // Cek turnstile token input
      turnstileToken = await page.evaluate(() => {
        const input =
          document.querySelector("input[name='cf-turnstile-response']") ||
          document.querySelector("input[name='g-recaptcha-response']");
        return input && input.value ? input.value : null;
      });

      // Cari iframe turnstile jika ada & coba klik checkbox otomatis
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const checkbox = await frame.$("input[type='checkbox'], #cf-stage");
          if (checkbox) {
            await checkbox.click().catch(() => {});
          }
        } catch (_) {}
      }

      if (!isCloudflareTitle && (!content.includes("cf-turnstile") || turnstileToken)) {
        // Jika sudah lolos challenge
        if (autoSubmit) {
          const submitBtn = await page.$("button[type='submit'], input[type='submit'], button.bg-blue-600");
          if (submitBtn) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {}),
              submitBtn.click().catch(() => {}),
            ]);
          }
        }
        break;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {});
    }

    const finalUrl = page.url();
    const pageContent = await page.content();
    const cookies = await page.cookies();

    return {
      finalUrl,
      pageContent,
      cookies,
      turnstileToken,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
