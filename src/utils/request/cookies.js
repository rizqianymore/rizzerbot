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

import { detectProtection, isSolvableType } from "./protection.js";

export const cookieJar = new CookieJar();

export function isCloudflareChallenge(status, headers = {}, body = "") {
  const det = detectProtection({ status, headers, html: body });
  if (det.type === "rate-limit") return false;
  return isSolvableType(det.type);
}
