import { stealthBrowser } from "@/src/utils/request.js";
import { brightDataRequest, getBrightDataConfig } from "@/src/services/network/brightdata.js";
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
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await getRecaptchaToken();

      let data = null;
      try {
        const res = await fetchWithTimeout(searchUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
            "User-Agent": UA,
            "x-recaptcha-token": token,
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

      if (!data && apiKey) {
        try {
          const bdRes = await brightDataRequest(searchUrl, {
            format: "json",
            method: "GET",
            headers: {
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "x-recaptcha-token": token,
            },
            timeout: 25000,
          });
          if (bdRes?.status === "success") {
            data = bdRes.data || {};
          }
        } catch (_) {}
      }

      if (!data) {
        try {
          const inPageRes = await stealthBrowser.inPageFetch(searchUrl, {
            method: "GET",
            headers: {
              Accept: "application/json, text/plain, */*",
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "x-recaptcha-token": token,
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

      throw lastErr || new Error("Gagal mengambil respon pencarian PDDikti");
    } catch (err) {
      lastErr = err;
      if (/403|token|recaptcha/i.test(err.message) && attempt < retries) continue;
      if (
        (err?.name === "AbortError" ||
          /timeout|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|net::|ERR_|NETWORK/i.test(
            err.message
          )) &&
        attempt < retries
      ) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}
