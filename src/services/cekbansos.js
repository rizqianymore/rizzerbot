import axios from "axios";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { stealthBrowser } from "@/src/utils/request.js";
import { brightDataRequest, getBrightDataConfig } from "@/src/services/brightdata.js";

const BASE = "https://cekbansos.kemensos.go.id";
const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 25000,
  maxRedirects: 0,
  validateStatus: () => true,
});

function newJar() {
  return new Map();
}

function storeCookies(jar, setCookieHeader) {
  if (!setCookieHeader) return;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of list) {
    if (typeof c !== "string") continue;
    const pair = c.split(";")[0].trim();
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function baseHeaders(jar, extra = {}) {
  return {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    ...(cookieHeader(jar) ? { Cookie: cookieHeader(jar) } : {}),
    ...extra,
  };
}

export async function fetchFormSession() {
  const { apiKey } = getBrightDataConfig();
  if (apiKey) {
    try {
      const html = await brightDataRequest(BASE, { format: "raw", timeout: 25000 });
      const token = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] || "";
      const captchaPath = html.match(/<img\s+src="([^"]*captcha[^"]*)"/)?.[1] || "";
      if (token && captchaPath) {
        const captchaUrl = captchaPath.startsWith("http")
          ? captchaPath
          : `${BASE}${captchaPath.startsWith("/") ? "" : "/"}${captchaPath}`;
        return { jar: newJar(), token, captchaUrl, via: "brightdata" };
      }
    } catch (_) {}
  }

  const jar = newJar();
  try {
    const res = await client.get(`${BASE}/`, { headers: baseHeaders(jar) });
    storeCookies(jar, res.headers["set-cookie"]);
    const html = typeof res.data === "string" ? res.data : "";
    const token = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] || "";
    const captchaPath = html.match(/<img\s+src="([^"]*captcha[^"]*)"/)?.[1] || "";
    if (token && captchaPath) {
      const captchaUrl = captchaPath.startsWith("http")
        ? captchaPath
        : `${BASE}${captchaPath.startsWith("/") ? "" : "/"}${captchaPath}`;
      return { jar, token, captchaUrl, via: "direct" };
    }
  } catch (_) {}

  // Fallback via stealth browser
  const browser = await stealthBrowser.getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    const info = await page.evaluate(() => {
      const token = document.querySelector('input[name="_token"]')?.value || "";
      const img = document.querySelector('img[src*="captcha"]')?.src || "";
      return { token, img };
    });
    if (info.token && info.img) {
      return { jar, token: info.token, captchaUrl: info.img, via: "browser" };
    }
    throw new Error("Gagal membaca token bansos dari browser");
  } finally {
    await page.close().catch(() => {});
  }
}

export async function fetchCaptchaImage(session) {
  if (session?.via === "brightdata") {
    try {
      const buf = await brightDataRequest(session.captchaUrl, { format: "raw", timeout: 20000 });
      return Buffer.from(buf);
    } catch (_) {}
  }

  try {
    const url = session.captchaUrl || `${BASE}/captcha/flat?${Math.random().toString(36).slice(2)}`;
    const res = await client.get(url, {
      headers: baseHeaders(session.jar, { Referer: `${BASE}/` }),
      responseType: "arraybuffer",
      timeout: 10000,
    });
    storeCookies(session.jar, res.headers["set-cookie"]);
    if (res.status === 200 && res.data?.length) {
      return Buffer.from(res.data);
    }
  } catch (_) {}

  // Fallback via stealthBrowser
  const browser = await stealthBrowser.getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector('img[src*="captcha"]', { timeout: 8000 });
    const b64 = await page.evaluate(async () => {
      const img = document.querySelector('img[src*="captcha"]');
      if (!img) return null;
      const res = await fetch(img.src);
      const buffer = await res.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    });
    if (b64) return Buffer.from(b64, "base64");
    throw new Error("Gagal mengunduh gambar captcha via browser");
  } finally {
    await page.close().catch(() => {});
  }
}

export async function submitNik(session, nik, code) {
  const body = new URLSearchParams({ _token: session.token, nik_input: nik, captcha: code }).toString();
  const res = await client.post(`${BASE}/cekbansos_nik`, body, {
    headers: baseHeaders(session.jar, {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Referer: `${BASE}/`,
    }),
  });
  storeCookies(session.jar, res.headers["set-cookie"]);
  const location = res.headers["location"] || "";
  return { success: location.includes("/hasil-nik"), location, status: res.status };
}

export async function fetchHasil(session) {
  const res = await client.get(`${BASE}/hasil-nik`, {
    headers: baseHeaders(session.jar, { Referer: `${BASE}/` }),
  });
  storeCookies(session.jar, res.headers["set-cookie"]);
  if (res.status !== 200 || typeof res.data !== "string") throw new Error("Gagal memuat halaman hasil");
  return res.data;
}

async function preprocessCaptcha(buffer) {
  return sharp(buffer)
    .grayscale()
    .normalize()
    .resize({ width: 480 })
    .threshold(165)
    .png()
    .toBuffer();
}

export async function solveCaptchaGemini(imageBuffer) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  try {
    const b64 = Buffer.isBuffer(imageBuffer) ? imageBuffer.toString("base64") : String(imageBuffer);
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: "Analyze this image containing a distorted 4-character CAPTCHA text. Output ONLY the 4 characters, in exact order, with no spaces, punctuation, or explanations."
              },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: b64,
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        }
      },
      { timeout: 8000 }
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.replace(/[^a-zA-Z0-9]/g, "");
    if (text && text.length === 4) return text;
  } catch (_) {}
  return null;
}

export async function solveCaptchaTesseractJs(imageBuffer) {
  try {
    const { createWorker } = await import("tesseract.js");
    const pre = await preprocessCaptcha(imageBuffer);
    const worker = await createWorker("eng");
    const ret = await worker.recognize(pre);
    await worker.terminate();
    const clean = ret?.data?.text?.trim()?.replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch (_) {
    return null;
  }
}

export async function isOcrAvailable() {
  return true;
}

const OCRSPACE_URL = "https://api.ocr.space/parse/image";

export async function solveCaptchaRemote(imageBuffer, engine = "2") {
  try {
    const pre = await preprocessCaptcha(imageBuffer);
    const b64 = `data:image/png;base64,${pre.toString("base64")}`;
    const body = new URLSearchParams({
      base64Image: b64,
      OCREngine: engine,
      isTable: "false",
      scale: "true",
      detectOrientation: "false",
      isOverlayRequired: "false",
    }).toString();
    const res = await client.post(OCRSPACE_URL, body, {
      headers: {
        apikey: process.env.OCRSPACE_API_KEY || "helloworld",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 12000,
    });
    const text = res.data?.ParsedResults?.[0]?.ParsedText || "";
    const clean = String(text).replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch {
    return null;
  }
}

export async function solveCaptcha(imageBuffer) {
  const candidates = [];
  const push = (g, via) => {
    const clean = String(g || "").replace(/[^A-Za-z0-9]/g, "");
    if (clean && !candidates.some((c) => c.guess === clean)) candidates.push({ guess: clean, via });
  };

  // 1. Gemini Vision AI (highest accuracy)
  const gemini = await solveCaptchaGemini(imageBuffer);
  if (gemini) push(gemini, "gemini-ai");

  // 2. Pure JS / WASM Tesseract.js (runs locally everywhere)
  const tesseract = await solveCaptchaTesseractJs(imageBuffer);
  if (tesseract) push(tesseract, "tesseract.js");

  // 3. Remote OCR.space fallback
  for (const engine of ["2", "1"]) {
    const remote = await solveCaptchaRemote(imageBuffer, engine);
    if (remote) push(remote, `remote-e${engine}`);
    if (candidates.length >= 2) break;
  }

  candidates.sort((a, b) => Number(b.guess.length === 4) - Number(a.guess.length === 4));
  if (!candidates.length) return { guess: null, via: null, alternates: [] };
  const [first, ...rest] = candidates;
  return { guess: first.guess, via: first.via, alternates: rest };
}

function stripTags(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHasil(html) {
  const badge = html.match(/DTSEN\s+TRIWULAN\s+[\d.]+\s*\d*/i)?.[0]?.trim() || "";
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const rows = [];
  for (const tr of tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 11) continue;
    rows.push({
      nama: cells[0] || "-",
      desil: cells[1] || "-",
      ketDtsen: cells[2] || "-",
      sembako: cells[3] || "-",
      sembakoPeriode: cells[4] || "-",
      pkh: cells[5] || "-",
      pkhPeriode: cells[6] || "-",
      pbi: cells[7] || "-",
      pbiPeriode: cells[8] || "-",
      pbiKet: cells[9] || "-",
      kpd: cells[10] || "-",
    });
  }
  return { badge, rows };
}

export function formatHasil(nik, parsed) {
  const maskNik = (n) => (n.length === 16 ? `${n.slice(0, 6)}********${n.slice(-4)}` : n);

  const ACRONYMS = new Set(["dtsen", "nik", "pkh", "pbi", "jk", "kpd", "ktp"]);
  const neatWord = (w) => {
    const l = w.toLowerCase();
    if (!l) return w;
    if (ACRONYMS.has(l)) return l.toUpperCase();
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  const neat = (s) =>
    String(s || "-")
      .toLowerCase()
      .split(/(\s+|[()/|-])/)
      .map((t) => (/^[\s()/|-]+$/.test(t) ? t : neatWord(t)))
      .join("");
  let text = `*HASIL CEK BANSOS*\n`;
  if (parsed.badge) text += `${neat(parsed.badge)}\n`;
  text += `NIK: ${maskNik(nik)}\n\n`;
  if (!parsed.rows.length) {
    return text + `Data tidak ditemukan untuk NIK tersebut (tidak terdaftar sebagai penerima manfaat).`;
  }
  for (const r of parsed.rows) {
    text +=
      `Nama: ${neat(r.nama)}\n` +
      `Desil: ${neat(r.desil)} (${neat(r.ketDtsen)})\n` +
      `Sembako: ${neat(r.sembako)}${r.sembakoPeriode !== "-" ? ` (${neat(r.sembakoPeriode)})` : ""}\n` +
      `PKH: ${neat(r.pkh)}${r.pkhPeriode !== "-" ? ` (${neat(r.pkhPeriode)})` : ""}\n` +
      `PBI-JK: ${neat(r.pbi)}${r.pbiPeriode !== "-" ? ` (${neat(r.pbiPeriode)})` : ""}${r.pbiKet !== "-" ? ` — ${neat(r.pbiKet)}` : ""}\n` +
      `KPD: ${neat(r.kpd)}\n`;
  }
  return text.trim();
}

export async function cekBansosOtomatis(nik, { maxAttempts = 3 } = {}) {
  const browser = await stealthBrowser.getBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 25000 });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await page.waitForSelector('img[src*="captcha"]', { timeout: 10000 }).catch(() => {});

      const captchaB64 = await page.evaluate(async () => {
        const img = document.querySelector('img[src*="captcha"]');
        if (!img) return null;
        const res = await fetch(img.src);
        const buffer = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      });

      if (!captchaB64) break;

      const imgBuffer = Buffer.from(captchaB64, "base64");
      const { guess, alternates } = await solveCaptcha(imgBuffer);
      const codeTries = [guess, ...(alternates || []).map((a) => a.guess)].filter(Boolean).slice(0, 2);

      if (!codeTries.length) continue;

      for (const code of codeTries) {
        // Clear & type inputs
        await page.evaluate(() => {
          const nikInput = document.querySelector("#cek_peserta_nik");
          const captchaInput = document.querySelector("#captcha");
          if (nikInput) nikInput.value = "";
          if (captchaInput) captchaInput.value = "";
        });

        await page.type("#cek_peserta_nik", nik);
        await page.type("#captcha", code);
        await page.click("#btnCekNik").catch(() => {});

        await new Promise((r) => setTimeout(r, 2500));

        const pageContent = await page.content();
        const bodyText = await page.evaluate(() => document.body.innerText || "");

        if (/Kode Captcha salah/i.test(bodyText)) {
          // Captcha salah, lanjut ke percobaan berikutnya
          continue;
        }

        if (pageContent.includes("<tbody>") || /HASIL PENCARIAN|DTSEN|Penerima Manfaat/i.test(bodyText)) {
          return { status: "ok", result: parseHasil(pageContent), attempts: attempt };
        }

        if (/Data tidak ditemukan|tidak terdaftar/i.test(bodyText)) {
          return { status: "ok", result: { badge: "", rows: [] }, attempts: attempt };
        }
      }

      // Reload captcha jika gagal
      await page.evaluate(() => {
        const reloadBtn = document.querySelector('button[onclick*="reload"], .btn-refresh, a[href*="reload"]');
        if (reloadBtn) reloadBtn.click();
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    return { status: "captcha-gagal" };
  } finally {
    await page.close().catch(() => {});
  }
}

const pendingManual = new Map();
const PENDING_TTL_MS = 5 * 60 * 1000;

export function savePendingSession(senderJid, session, nik, image = null) {
  pendingManual.set(senderJid, { ...session, nik, image, expires: Date.now() + PENDING_TTL_MS });
  if (pendingManual.size > 200) {
    const now = Date.now();
    for (const [k, v] of pendingManual.entries()) if (v.expires < now) pendingManual.delete(k);
  }
}

export function peekPendingSession(senderJid, nik) {
  const p = pendingManual.get(senderJid);
  if (!p || p.expires < Date.now() || p.nik !== nik) return null;
  return p;
}

export function takePendingSession(senderJid, nik) {
  const p = peekPendingSession(senderJid, nik);
  if (!p) return null;
  pendingManual.delete(senderJid);
  return p;
}
