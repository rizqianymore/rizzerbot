import fs from "fs";
import { isTermux, isAndroid } from "@/src/utils/termux.js";

function browserDisabledByEnv() {
  return ["1", "true", "yes"].includes(String(process.env.BROWSER_DISABLED || "").toLowerCase());
}

function findSystemChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    "/data/data/com.termux/files/usr/bin/chromium",
    "/data/data/com.termux/files/usr/bin/chromium-browser",
    "/data/data/com.termux/files/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/homebrew/bin/chromium",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

export class StealthBrowserCore {
  constructor() {
    this.browser = null;
    this.idleTimer = null;
    this.isLaunching = false;
    this.activePages = 0;
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

    if (browserDisabledByEnv()) {
      throw new Error(
        "Browser otomatis dimatikan (BROWSER_DISABLED=1). Fitur scraping yang butuh browser tidak tersedia."
      );
    }

    this.isLaunching = true;
    try {
      if (this.browser) {
        try {
          await this.browser.close().catch(() => {});
        } catch (_) {}
        this.browser = null;
      }

      let puppeteer;
      try {
        ({ default: puppeteer } = await import("puppeteer"));
      } catch (err) {
        throw new Error(
          "Modul 'puppeteer' tidak terinstall/tidak bisa dimuat." +
            (isTermux() || isAndroid()
              ? " Di Termux browser dimatikan secara default — install manual bila perlu: pkg install chromium, lalu set CHROME_PATH. Atau set BROWSER_DISABLED=1 untuk menonaktifkan fitur browser."
              : " Jalankan: npm install puppeteer."),
          { cause: err }
        );
      }
      const launchOpts = {
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
      };
      const systemChrome = findSystemChrome();
      if (systemChrome) {
        launchOpts.executablePath = systemChrome;
      }
      try {
        this.browser = await puppeteer.launch(launchOpts);
      } catch (err) {
        const hint =
          isTermux() || isAndroid()
            ? "Chrome/Chromium tidak bisa jalan di Termux secara default. Install: pkg install chromium lalu set CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium, atau set BROWSER_DISABLED=1."
            : "Pastikan Chrome/Chromium terinstall atau set PUPPETEER_EXECUTABLE_PATH.";
        throw new Error(`Gagal meluncurkan browser: ${err?.message}. ${hint}`, { cause: err });
      }

      this.browser.on("disconnected", () => {
        this.browser = null;
        this.activePages = 0;
      });

      return this.browser;
    } finally {
      this.isLaunching = false;
    }
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(() => {
      if (this.activePages <= 0) {
        this.close();
      } else {
        this._resetIdleTimer();
      }
    }, 45000);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  async newPage() {
    this.activePages++;
    this._resetIdleTimer();
    try {
      const browser = await this.getBrowser();
      return await browser.newPage();
    } catch (err) {
      if (/Target\.createTarget|target closed|Session closed|Connection closed/i.test(err.message)) {
        if (this.browser) {
          try {
            await this.browser.close().catch(() => {});
          } catch (_) {}
          this.browser = null;
        }
        const freshBrowser = await this.getBrowser();
        return await freshBrowser.newPage();
      }
      this.activePages = Math.max(0, this.activePages - 1);
      throw err;
    }
  }

  async closePage(page) {
    this.activePages = Math.max(0, this.activePages - 1);
    this._resetIdleTimer();
    if (page) {
      try {
        await page.close().catch(() => {});
      } catch (_) {}
    }
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
      this.activePages = 0;
    }
  }
}
