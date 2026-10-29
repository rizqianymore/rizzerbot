import { stealthBrowser } from "@/src/utils/request.js";
import { brightDataRequest, getBrightDataConfig, isBrightDataEnabled } from "@/src/services/network/brightdata.js";
import { BASE, UA, SEARCH_TTL_MS, searchCache, cacheGet, cacheSet, fetchWithTimeout } from "./constants.js";
import { getRecaptchaToken } from "./token.js";

export async function searchPddikti(keyword, { retries = 2 } = {}) {
  const kw = String(keyword ?? "").trim();
  if (!kw) throw new Error("keyword wajib diisi");
  if (kw.length > 100) throw new Error("keyword terlalu panjang (maks 100 karakter)");

  const cached = cacheGet(searchCache, kw.toLowerCase());
  if (cached) return cached;

  const { apiKey } = getBrightDataConfig();
  const searchUrl = `${BASE}/api/pencarian/enc/all/${encodeURIComponent(kw)}`;

  let lastErr = null;
  let brightDataTried = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await getRecaptchaToken();

      let data = null;

      // === CORRECT ORDER: direct → brightdata → stealthbrowser ===
      // 1. Coba direct fetch dulu (cepat kalau tidak ada proteksi)
      try {
        const res = await fetchWithTimeout(searchUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
            "User-Agent": UA,
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.status === "success") {
            data = json.data || {};
          }
        }
      } catch (fetchErr) {
        lastErr = fetchErr;
      }

      // 2. Jika direct gagal dan BrightData tersedia, coba Web Unlocker REST API
      if (!data && apiKey && !brightDataTried) {
        brightDataTried = true;
        try {
          const bdRes = await brightDataRequest(searchUrl, {
            format: "json",
            method: "GET",
            headers: {
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "User-Agent": UA,
            },
            timeout: 25000,
          });
          if (bdRes?.status === "success") {
            data = bdRes.data || {};
          }
        } catch (_) {}
      }

      // 3. Jika BrightData juga gagal, pakai stealth browser sebagai cadangan
      if (!data) {
        try {
          const inPageRes = await stealthBrowser.inPageFetch(searchUrl, {
            method: "GET",
            headers: {
              Accept: "application/json, text/plain, */*",
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "User-Agent": UA,
            },
          });
          if (inPageRes?.status === "success") {
            data = inPageRes.data || {};
          }
        } catch (inPageErr) {
          lastErr = inPageErr;
      }
      }

      if (data) {
        cacheSet(searchCache, kw.toLowerCase(), data, SEARCH_TTL_MS);
        return data;
      }

      // Jika error transien (timeout, koneksi), coba lagi dengan backoff
      if (/timeout|ECONNRESET|ETIMEDOUT|ECONNABORTED/.test(String(lastErr?.message || "")) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      // Jika terdeteksi proteksi (403, token expired), langsung lewat BrightData
      if (/403|token|recaptcha/i.test(String(lastErr?.message || "")) && attempt < retries && apiKey && !brightDataTried) {
        brightDataTried = true;
        try {
          const bdRes = await brightDataRequest(searchUrl, {
            format: "json",
            method: "GET",
            headers: {
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "x-recaptcha-token": token,
              "User-Agent": UA,
            },
            timeout: 25000,
          });
          if (bdRes?.status === "success") {
            data = bdRes.data || {};
          }
        } catch (_) {}
      }

      if (data) {
        cacheSet(searchCache, kw.toLowerCase(), data, SEARCH_TTL_MS);
        return data;
      }

      // Wait before retry with exponential backoff
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    } catch (err) {
      lastErr = err;
      // Jika error jaringan, coba jalur BrightData di percobaan selanjutnya
      if (/ECONN|ENOTFOUND|ETIMEDOUT|network|NETWORK/i.test(err.message || "") && attempt < retries && apiKey && !brightDataTried) {
        brightDataTried = true;
        try {
          const bdRes = await brightDataRequest(searchUrl, {
            format: "json",
            method: "GET",
            headers: {
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "User-Agent": UA,
            },
            timeout: 25000,
          });
          if (bdRes?.status === "success") {
            data = bdRes.data || {};
          }
        } catch (_) {}
      }
    }
  }

  throw lastErr;
}