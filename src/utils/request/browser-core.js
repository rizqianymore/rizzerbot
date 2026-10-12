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

    this.isLaunching = true;
    try {
      if (this.browser) {
        try {
          await this.browser.close().catch(() => {});
        } catch (_) {}
        this.browser = null;
      }

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
      // Hanya auto-close jika tidak ada page yang sedang aktif
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
      // Jika terjadi error Protocol error / target closed, reset browser dan coba ulang sekali
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
