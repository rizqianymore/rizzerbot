/**
 * Deteksi proteksi (Cloudflare, DataDome, Incapsula, dll) pada respons HTTP.
 *
 * Dipakai oleh rantai anti-protection `scraper/chain.js` untuk memutuskan
 * apakah hasil request perlu di-eskalasi ke jalur yang lebih mahal
 * (Web Unlocker -> native proxy -> browser stealth -> Scraping Browser).
 */

import { detectProtection } from "@/src/utils/request/protection.js";

/** Status HTTP yang mengindikasikan request diblokir proteksi (bukan 404). */
const BLOCKED_STATUS = new Set([401, 403, 406, 418, 429]);

/** Status HTTP yang berarti "memang tidak ada" -> gagal cepat, jangan eskalasi. */
const NOT_FOUND_STATUS = new Set([404, 410]);

/** Penanda halaman challenge yang sering muncul tanpa header khas. */
const CHALLENGE_MARKERS = [
  "just a moment",
  "checking your browser",
  "cf-browser-verification",
  "attention required",
  "_cf_chl_opt",
  "enable javascript and cookies to continue",
  "ddos-guard",
  "checking if the site connection is secure",
  "px-captcha",
  "datadome",
  "incapsula",
  "akamai bot manager",
];

/**
 * Ambil cuplikan teks dari data respons (buffer/text) untuk diinspeksi.
 * @param {*} data
 * @returns {string}
 */
export function toTextSnippet(data, maxLength = 4000) {
  if (!data) return "";
  if (Buffer.isBuffer(data)) return data.slice(0, maxLength).toString("utf8");
  if (typeof data === "string") return data.slice(0, maxLength);
  try {
    return JSON.stringify(data).slice(0, maxLength);
  } catch (_) {
    return "";
  }
}

/**
 * Deteksi proteksi pada satu respons.
 * @returns {{type: string, confidence: string, blocked: boolean}}
 */
export function detectResponseProtection({ status = 0, headers = {}, data = "" } = {}) {
  const body = toTextSnippet(data);
  const code = Number(status) || 0;
  const lower = body.toLowerCase();

  // Respons sukses (2xx): hanya anggap sebagai challenge kalau body-nya memang
  // halaman challenge. Banyak situs dilayani Cloudflare (npm, GitHub, ...)
  // tanpachallenge sama sekali — header "server: cloudflare" bukan bukti proteksi.
  if (code >= 200 && code < 300) {
    const looksChallenge = CHALLENGE_MARKERS.some((marker) => lower.includes(marker));
    if (!looksChallenge) {
      return { type: "none", confidence: "high", blocked: false };
    }
    return { type: "cloudflare-challenge", confidence: "high", blocked: true };
  }

  const det = detectProtection({ status, headers, html: body });
  if (det.type && det.type !== "none") {
    return { ...det, blocked: true };
  }

  if (CHALLENGE_MARKERS.some((marker) => lower.includes(marker))) {
    return { type: "cloudflare-challenge", confidence: "medium", blocked: true };
  }

  if (BLOCKED_STATUS.has(code)) {
    return { type: "generic-captcha", confidence: "medium", blocked: true };
  }

  return { type: "none", confidence: "high", blocked: false };
}

/**
 * Klasifikasi status HTTP:
 *  - "ok"        : lanjut (2xx/3xx)
 *  - "notfound"  : gagal cepat (404/410) -> jangan boros kuota Bright Data
 *  - "blocked"   : kemungkinan proteksi -> eskalasi
 *  - "server"    : error server -> eskalasi/ retry
 */
export function classifyStatus(status) {
  const code = Number(status) || 0;
  if (code === 0) return "server";
  if (NOT_FOUND_STATUS.has(code)) return "notfound";
  if (code >= 500) return "server";
  if (BLOCKED_STATUS.has(code)) return "blocked";
  return "ok";
}

/**
 * Deteksi proteksi dari pesan error yt-dlp / axios.
 * Contoh: "Unable to download webpage: HTTP Error 403: Forbidden".
 */
export function detectErrorProtection(err) {
  const message = String(err?.message || err || "");
  const lower = message.toLowerCase();
  const patterns = [
    ["cloudflare-challenge", "just a moment"],
    ["cloudflare-challenge", "cf-browser-verification"],
    ["cloudflare-challenge", "cloudflare"],
    ["generic-captcha", "captcha"],
    ["generic-captcha", "are you human"],
    ["generic-captcha", "verify you are human"],
    ["incapsula", "incapsula"],
    ["datadome", "datadome"],
    ["akamai", "akamai"],
    ["safeline", "safeline"],
    ["perimeterx", "px-captcha"],
    ["rate-limit", "too many requests"],
  ];
  for (const [type, needle] of patterns) {
    if (lower.includes(needle)) return { type, confidence: "medium", blocked: true };
  }
  if (/http error (401|403|406|418|429)/i.test(message)) {
    return { type: "generic-captcha", confidence: "low", blocked: true };
  }
  return { type: "none", confidence: "high", blocked: false };
}

/** Label ramah-user untuk ditampilkan di caption/log. */
export function protectionLabel(type) {
  const map = {
    "cloudflare-challenge": "Cloudflare",
    "cloudflare-turnstile": "Cloudflare Turnstile",
    incapsula: "Incapsula",
    datadome: "DataDome",
    akamai: "Akamai",
    perimeterx: "PerimeterX",
    safeline: "SafeLine",
    sucuri: "Sucuri",
    "ddos-guard": "DDoS-Guard",
    "generic-captcha": "Captcha/Challenge",
    "rate-limit": "Rate Limit",
  };
  return map[type] || "Proteksi";
}

export default {
  detectResponseProtection,
  detectErrorProtection,
  classifyStatus,
  protectionLabel,
  toTextSnippet,
};
