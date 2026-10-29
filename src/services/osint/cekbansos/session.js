import { brightDataRequest, getBrightDataConfig, isBrightDataEnabled } from "@/src/services/network/brightdata.js";
import { stealthBrowser } from "@/src/utils/request.js";
import { BASE, client, newJar, storeCookies, baseHeaders } from "./client.js";

export async function fetchFormSession() {
  const { apiKey } = getBrightDataConfig();

  // === TRY 1: Bright Data Web Unlocker REST API (PALING CEPAT) ===
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

  // === TRY 2: Direct fetch (jika BrightData gagal atau disabled) ===
  try {
    const res = await client.get(`${BASE}/`, { headers: baseHeaders(newJar()) });
    storeCookies(newJar(), res.headers["set-cookie"]);
    const html = typeof res.data === "string" ? res.data : "";
    const token = html.match(/name="_token"\s+value="([^"]+)"/)?.[1] || "";
    const captchaPath = html.match(/<img\s+src="([^"]*captcha[^"]*)"/)?.[1] || "";
    if (token && captchaPath) {
      const captchaUrl = captchaPath.startsWith("http")
        ? captchaPath
        : `${BASE}${captchaPath.startsWith("/") ? "" : "/"}${captchaPath}`;
      return { jar: newJar(), token, captchaUrl, via: "direct" };
    }
  } catch (_) {}

  // === TRY 3: Stealth Browser (JALUR AKHIR, paling berat tapi paling andal) ===
  const page = await stealthBrowser.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    const info = await page.evaluate(() => {
      const token = document.querySelector('input[name="_token"]')?.value || "";
      const img = document.querySelector('img[src*="captcha"]')?.src || "";
      return { token, img };
    });
    if (info.token && info.img) {
      return { jar: newJar(), token: info.token, captchaUrl: info.img, via: "browser" };
    }
    throw new Error("Gagal membaca token bansos dari browser");
  } finally {
    // Tutup browser sesi segera setelah dipakai (hemat kuota)
    await stealthBrowser.closePage(page);
  }
  // Error akan melempar ke atas jika page.goto atau evaluate gagal
} // <-- tutup try block

export async function fetchCaptchaImage(session) {
  // Prioritaskan jalur sesuai marked 'via' di session
  if (session?.via === "brightdata") {
    try {
      const buf = await brightDataRequest(session.captchaUrl, { format: "raw", timeout: 20000 });
      return Buffer.from(buf);
    } catch (_) {
      // Jika gagal lewat BrightData, turun ke browser session
    }
  }

  // Fallback: unduh lewat browser session atau client biasa
  try {
    const url = session?.captchaUrl || `${BASE}/captcha/flat?${Math.random().toString(36).slice(2)}`;
    const res = await client.get(url, {
      headers: baseHeaders(session?.jar),
      responseType: "arraybuffer",
      timeout: 10000,
    });
    storeCookies(session?.jar, res.headers["set-cookie"]);
    if (res.status === 200 && res.data?.length) {
      return Buffer.from(res.data);
    }
  } catch (_) {}

  // Fallback terakhir: browser capture
  try {
    const page = await stealthBrowser.newPage();
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
    } finally {
      await stealthBrowser.closePage(page);
    }
    throw new Error("Gagal mengunduh gambar captcha via browser");
  } catch (_) {
    return null;
  }
}

export async function submitNIK(session, nik, code) {
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