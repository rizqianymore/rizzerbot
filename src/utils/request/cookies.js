import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "..", "..", "..", "assets", "cache");
const COOKIES_CACHE_FILE = path.join(CACHE_DIR, "session_cookies.json");

class CookieJar {
  constructor() {
    this.cookies = new Map();
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
      return String(urlOrHost).toLowerCase().split("/")[0].split(":")[0];
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
    const defaultDomain = this.getDomainKey(domainOrUrl);

    for (const c of list) {
      if (typeof c !== "string") continue;
      const attributes = c.split(";").map((p) => p.trim());
      const firstPart = attributes.shift();
      if (!firstPart) continue;

      const eqIdx = firstPart.indexOf("=");
      if (eqIdx <= 0) continue;

      const key = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();

      let targetDomain = defaultDomain;
      for (const attr of attributes) {
        if (/^domain=/i.test(attr)) {
          const customDomain = attr.replace(/^domain=/i, "").trim().replace(/^\./, "").toLowerCase();
          if (customDomain) targetDomain = customDomain;
          break;
        }
      }

      if (!this.cookies.has(targetDomain)) {
        this.cookies.set(targetDomain, new Map());
      }
      this.cookies.get(targetDomain).set(key, val);
    }
    this._save();
  }

  getCookieString(domainOrUrl) {
    const targetDomain = this.getDomainKey(domainOrUrl);
    const combined = new Map();

    for (const [cookieDomain, jar] of this.cookies.entries()) {
      if (
        cookieDomain === targetDomain ||
        targetDomain.endsWith(`.${cookieDomain}`) ||
        cookieDomain.endsWith(`.${targetDomain}`)
      ) {
        for (const [k, v] of jar.entries()) {
          combined.set(k, v);
        }
      }
    }

    if (combined.size === 0) return "";
    return Array.from(combined.entries())
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

import { detectProtection, isSolvableType } from "./protection.js";

export const cookieJar = new CookieJar();

export function isCloudflareChallenge(status, headers = {}, body = "") {
  const numStatus = Number(status) || 0;

  if (numStatus >= 200 && numStatus < 300) {
    const text = String(body || "").toLowerCase();
    const isHtmlChallenge =
      text.includes("_cf_chl_opt") ||
      text.includes("challenges.cloudflare.com") ||
      text.includes("cf-browser-verification") ||
      text.includes("just a moment...");
    if (!isHtmlChallenge) return false;
  }
  const det = detectProtection({ status, headers, html: body });
  if (det.type === "rate-limit") return false;
  return isSolvableType(det.type);
}
