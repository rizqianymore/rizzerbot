import axios from "axios";
import sharp from "sharp";
import { execFile } from "node:child_process";

const BASE = "https://cekbansos.kemensos.go.id";
const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 25000,
  maxRedirects: 0,
  validateStatus: () => true,
});

// ── Session ringan per alur (JANGAN pakai cookie jar global:
// captcha terikat session cookie, user berbeda tidak boleh campur) ──
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

/** GET / → { jar, token, captchaUrl }. Melempar bila form tak dikenali. */
export async function fetchFormSession() {
  const jar = newJar();
  const res = await client.get(`${BASE}/`, { headers: baseHeaders(jar) });
  storeCookies(jar, res.headers["set-cookie"]);
  const html = typeof res.data === "string" ? res.data : "";
  const token = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] || "";
  const captchaPath = html.match(/<img\s+src="([^"]*captcha[^"]*)"/)?.[1] || "";
  if (!token || !captchaPath) throw new Error("Gagal membaca form cekbansos (struktur berubah?)");
  const captchaUrl = captchaPath.startsWith("http")
    ? captchaPath
    : `${BASE}${captchaPath.startsWith("/") ? "" : "/"}${captchaPath}`;
  return { jar, token, captchaUrl };
}

/** GET captcha (kode BARU tiap request, terikat session). */
export async function fetchCaptchaImage(session) {
  // Cache-buster seperti tombol refresh di web
  const url = `${BASE}/captcha/flat?${Math.random().toString(36).slice(2)}`;
  const res = await client.get(url, {
    headers: baseHeaders(session.jar, { Referer: `${BASE}/` }),
    responseType: "arraybuffer",
  });
  storeCookies(session.jar, res.headers["set-cookie"]);
  if (res.status !== 200 || !res.data?.length) throw new Error("Gagal mengunduh gambar captcha");
  return Buffer.from(res.data);
}

/**
 * POST /cekbansos_nik tanpa follow redirect.
 * Sukses = 302 ke /hasil-nik. Gagal (captcha salah) = 302 balik ke /.
 */
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

// ── OCR solver (tesseract; opsional — butuh `apt install tesseract-ocr` di VPS) ──
let _tesseractAvailable = null;

export async function isOcrAvailable() {
  if (_tesseractAvailable !== null) return _tesseractAvailable;
  try {
    await new Promise((resolve, reject) => {
      execFile("tesseract", ["--version"], { timeout: 8000 }, (err) =>
        err ? reject(err) : resolve()
      );
    });
    _tesseractAvailable = true;
  } catch {
    _tesseractAvailable = false;
  }
  return _tesseractAvailable;
}

/** Preprocess khas captcha flat kemensos: font tipis ungu, garis coret. */
async function preprocessCaptcha(buffer) {
  return sharp(buffer)
    .grayscale()
    .normalize()
    .resize({ width: 480 }) // 160x46 → ~3x, tegas untuk OCR
    .threshold(165)
    .png()
    .toBuffer();
}

function runTesseract(pngBuffer) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "tesseract",
      ["stdin", "stdout", "--psm", "8", "-c", "tessedit_char_whitelist=abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"],
      { timeout: 15000, maxBuffer: 256 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout || "")))
    );
    child.stdin.on("error", () => {});
    child.stdin.write(pngBuffer);
    child.stdin.end();
  });
}

/** Kembalikan tebakan kode (alnum) atau null bila OCR tak tersedia/gagal. */
export async function solveCaptchaOCR(imageBuffer) {
  if (!(await isOcrAvailable())) return null;
  try {
    const pre = await preprocessCaptcha(imageBuffer);
    const raw = await runTesseract(pre);
    const clean = raw.replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch {
    return null;
  }
}

// ── Solver remote (ocr.space, gratis, tanpa install; hanya gambar captcha yg dikirim, tanpa NIK) ──
const OCRSPACE_URL = "https://api.ocr.space/parse/image";

export async function solveCaptchaRemote(imageBuffer) {
  try {
    const pre = await preprocessCaptcha(imageBuffer);
    const b64 = `data:image/png;base64,${pre.toString("base64")}`;
    const body = new URLSearchParams({
      base64Image: b64,
      OCREngine: "2",
      isTable: "false",
    }).toString();
    const res = await client.post(OCRSPACE_URL, body, {
      headers: {
        apikey: process.env.OCRSPACE_API_KEY || "helloworld",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 30000,
    });
    const text = res.data?.ParsedResults?.[0]?.ParsedText || "";
    const clean = String(text).replace(/[^A-Za-z0-9]/g, "");
    return clean || null;
  } catch {
    return null;
  }
}

/** Chain solver: lokal (tesseract, cepat) → remote (ocr.space, tanpa install). */
export async function solveCaptcha(imageBuffer) {
  const local = await solveCaptchaOCR(imageBuffer);
  if (local) return { guess: local, via: "lokal" };
  const remote = await solveCaptchaRemote(imageBuffer);
  if (remote) return { guess: remote, via: "remote" };
  return { guess: null, via: null };
}

// ── Parser halaman hasil ──
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
  // Kapitalisasi rapi: kata biasa → huruf depan besar, singkatan → tetap besar.
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
  let text = `*Hasil Cek Bansos*\n`;
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

/**
 * Alur otomatis penuh: session baru → captcha → OCR → submit → hasil.
 * Ulangi dari awal (session+ captcha BARU) bila captcha ditolak.
 */
export async function cekBansosOtomatis(nik, { maxAttempts = 4 } = {}) {
  let lastGuess = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = await fetchFormSession();
    let image = await fetchCaptchaImage(session);
    const { guess } = await solveCaptcha(image);
    image = null; // lepas buffer segera (hemat memori)
    if (!guess) continue; // solver gagal baca → captcha baru
    lastGuess = guess;
    const { success } = await submitNik(session, nik, guess);
    if (!success) {
      await new Promise((r) => setTimeout(r, 400)); // jeda sopan antar percobaan
      continue; // kode salah → ulang dengan session+captcha baru
    }
    const html = await fetchHasil(session);
    return { status: "ok", result: parseHasil(html), attempts: attempt };
  }
  return { status: "captcha-gagal", lastGuess };
}

/** Penampung session manual: senderJid → { jar, token, nik, expires }. TTL 3 menit. */
const pendingManual = new Map();
const PENDING_TTL_MS = 3 * 60 * 1000;

export function savePendingSession(senderJid, session, nik) {
  pendingManual.set(senderJid, { ...session, nik, expires: Date.now() + PENDING_TTL_MS });
  if (pendingManual.size > 200) {
    const now = Date.now();
    for (const [k, v] of pendingManual.entries()) if (v.expires < now) pendingManual.delete(k);
  }
}

export function takePendingSession(senderJid, nik) {
  const p = pendingManual.get(senderJid);
  if (!p || p.expires < Date.now() || p.nik !== nik) return null;
  pendingManual.delete(senderJid);
  return p;
}
