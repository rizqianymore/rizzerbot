import { stealthBrowser } from "@/src/utils/request.js";
import { BASE } from "./client.js";
import { solveCaptcha } from "./captcha.js";
import { parseHasil } from "./parse.js";

export async function cekBansosOtomatis(nik, { maxAttempts = 3 } = {}) {
  const page = await stealthBrowser.newPage();

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
      const codeTries = [guess, ...(alternates || []).map((a) => a.guess)]
        .filter((g) => g && g.length === 4)
        .slice(0, 2);

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
      await page
        .evaluate(() => {
          const reloadBtn = document.querySelector('button[onclick*="reload"], .btn-refresh, a[href*="reload"]');
          if (reloadBtn) reloadBtn.click();
        })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    return { status: "captcha-gagal" };
  } finally {
    await stealthBrowser.closePage(page);
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
