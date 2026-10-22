import fs from "fs";
import { isTermux, isAndroid } from "@/src/utils/termux.js";

function browserDisabledByEnv() {
  return ["1", "true", "yes"].includes(String(process.env.BROWSER_DISABLED || "").toLowerCase());
}

/** Idle timeout: browser ditutup sendiri setelah tidak dipakai (hemat RAM). */
function idleTimeoutMs() {
  const raw = Number(process.env.BROWSER_IDLE_MS);
  if (Number.isFinite(raw) && raw >= 5000) return raw;
  return 30000;
}

/** Batas heap V8 untuk Chrome (MB) — biar browser tidak memakan RAM berlebihan. */
function maxOldSpaceMb() {
  const raw = Number(process.env.BROWSER_MAX_OLD_SPACE_MB);
  if (Number.isFinite(raw) && raw >= 64) return Math.floor(raw);
  return 192;
}

/** RSS (MB) proses browser dari /proc (Linux). */
export function browserMemoryMb(pid) {
  if (!pid) return null;
  try {
    const raw = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const match = raw.match(/VmRSS:\s+(\d+)\s+kB/);
    return match ? Math.round(Number(match[1]) / 1024) : null;
  } catch (_) {
    return null;
  }
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
    this.logger = null;
    this.launches = 0;
  }

  /** Pasang logger (pino) supaya lifecycle browser tercatat. */
  setLogger(logger) {
    this.logger = logger || null;
    return this;
  }

  _log(level, message, extra = {}) {
    const fn = this.logger?.[level] || this.logger?.info;
    if (typeof fn !== "function") return;
    try {
      fn.call(this.logger, `[Browser] ${message}`, extra);
    } catch (_) {}
  }

  /** Status ringkas browser (untuk log & monitor). */
  status() {
    const pid = this.browser?.process()?.pid || null;
    return {
      running: Boolean(this.browser?.connected),
      pid,
      pages: this.activePages,
      rssMb: browserMemoryMb(pid),
      launches: this.launches,
    };
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
          // --- hemat RAM & stabilitas ---
          `--js-flags=--max-old-space-size=${maxOldSpaceMb()}`,
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-client-side-phishing-detection",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-service-autorun",
          "--password-store=basic",
          "--use-mock-keychain",
        ],
      };
      const systemChrome = findSystemChrome();
      if (systemChrome) {
        launchOpts.executablePath = systemChrome;
      }
      const startedAt = Date.now();
      try {
        this.browser = await puppeteer.launch(launchOpts);
      } catch (err) {
        const hint =
          isTermux() || isAndroid()
            ? "Chrome/Chromium tidak bisa jalan di Termux secara default. Install: pkg install chromium lalu set CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium, atau set BROWSER_DISABLED=1."
            : "Pastikan Chrome/Chromium terinstall atau set PUPPETEER_EXECUTABLE_PATH.";
        this._log("warn", `gagal launch: ${String(err?.message || err).slice(0, 160)}`);
        throw new Error(`Gagal meluncurkan browser: ${err?.message}. ${hint}`, { cause: err });
      }

      this.launches += 1;
      const pid = this.browser.process()?.pid || null;
      this._log("info", "launch", {
        pid,
        launches: this.launches,
        maxOldSpaceMb: maxOldSpaceMb(),
        ms: Date.now() - startedAt,
        rssMb: browserMemoryMb(pid),
      });

      this.browser.on("disconnected", () => {
        this._log("warn", "browser terputus (crash/di-close)", { pid, pages: this.activePages });
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

    const timeout = idleTimeoutMs();
    this.idleTimer = setTimeout(() => {
      if (this.activePages <= 0) {
        this._log("info", "idle -> tutup browser (hemat RAM)", {
          timeoutMs: timeout,
          rssMb: browserMemoryMb(this.browser?.process()?.pid || null),
        });
        this.close();
      } else {
        this._resetIdleTimer();
      }
    }, timeout);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  async newPage() {
    this.activePages++;
    this._resetIdleTimer();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      this._log("debug", "page dibuka", { pages: this.activePages, rssMb: this.status().rssMb });
      return page;
    } catch (err) {
      if (/Target\.createTarget|target closed|Session closed|Connection closed/i.test(err.message)) {
        this._log("warn", "page gagal dibuka, relaunch browser", {
          detail: String(err.message).slice(0, 120),
        });
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
    this._log("debug", "page ditutup", { pages: this.activePages, rssMb: this.status().rssMb });
  }

  async close() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      const pid = this.browser.process()?.pid || null;
      const rssMb = browserMemoryMb(pid);
      try {
        await this.browser.close();
      } catch (_) {}
      this.browser = null;
      this.activePages = 0;
      this._log("info", "browser ditutup", { pid, rssMb });
    }
  }
}
