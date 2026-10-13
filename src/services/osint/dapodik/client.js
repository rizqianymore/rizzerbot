import { stealthBrowser } from "@/src/utils/request.js";

// Portal Dapodik (Kemendikdasmen) di balik WAF SafeLine sehingga fetch biasa
// selalu 403. Semua request wajib lewat browser yang sudah lolos WAF,
// lalu memakai token API dari /env.js (sama seperti yang dipakai UI resminya).
export const BASE = "https://dapo.kemendikdasmen.go.id";
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const SEARCH_TTL_MS = 10 * 60 * 1000;
export const DETAIL_TTL_MS = 60 * 60 * 1000;

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
let tokenCache = { value: "", expires: 0 };

export function cacheGet(map, key) {
  const hit = map.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  if (hit) map.delete(key);
  return null;
}

export function cacheSet(map, key, data, ttl) {
  map.set(key, { data, expires: Date.now() + ttl });
  if (map.size > 200) map.delete(map.keys().next().value);
}

async function resolveToken(page) {
  if (tokenCache.value && tokenCache.expires > Date.now()) return tokenCache.value;

  const envText = await page
    .evaluate(async () => {
      try {
        const res = await fetch("/env.js", { credentials: "include" });
        return await res.text();
      } catch (_) {
        return "";
      }
    })
    .catch(() => "");

  const match = String(envText || "").match(/VITE_API_TOKEN\s*:\s*"([^"]+)"/);
  if (!match) throw new Error("Token API Dapodik tidak ditemukan di /env.js");
  tokenCache = { value: match[1], expires: Date.now() + TOKEN_TTL_MS };
  return tokenCache.value;
}

/**
 * Buka satu halaman browser (lolos WAF), lalu jalankan fetch JSON dari dalam
 * halaman itu. Satu halaman dipakai untuk banyak request agar hemat resource.
 */
export async function withDapoPage(fn) {
  const page = await stealthBrowser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});

    const fetchJson = async (path) => {
      const token = await resolveToken(page);
      const result = await page.evaluate(
        async (url, bearer) => {
          try {
            const res = await fetch(url, {
              credentials: "include",
              headers: { authorization: `Bearer ${bearer}`, Accept: "application/json" },
            });
            const text = await res.text();
            let json = null;
            try {
              json = JSON.parse(text);
            } catch (_) {}
            return { ok: res.ok, status: res.status, json, snippet: text.slice(0, 160) };
          } catch (err) {
            return { ok: false, status: 0, error: err.message };
          }
        },
        path,
        token
      );

      if (!result.ok) {
        // Token kemungkinan dirotasi -> paksa ambil ulang pada request berikutnya.
        if (result.status === 401 || result.status === 403) tokenCache = { value: "", expires: 0 };
        throw new Error(result.error || `Dapodik HTTP ${result.status}${result.snippet ? `: ${result.snippet}` : ""}`);
      }
      return result.json;
    };

    return await fn(fetchJson);
  } finally {
    await stealthBrowser.closePage(page);
  }
}
