import { stealthBrowser } from "@/src/utils/request.js";
import { SEARCH_TTL_MS, searchCache, cacheGet, cacheSet, BASE } from "./constants.js";

export async function searchPddikti(keyword, { timeoutMs = 35000 } = {}) {
  const kw = String(keyword ?? "").trim();
  if (!kw) throw new Error("keyword wajib diisi");
  if (kw.length > 100) throw new Error("keyword terlalu panjang (maks 100 karakter)");

  const cached = cacheGet(searchCache, kw.toLowerCase());
  if (cached) return cached;

  const page = await stealthBrowser.newPage();
  let searchResult = null;
  let pageErr = null;

  const onResponse = async (res) => {
    const url = res.url();
    if (url.includes("api-pddikti") && url.includes("pencarian")) {
      try {
        const json = await res.json();
        if (json?.status === "success" && json.data) {
          searchResult = json.data;
        }
      } catch (_) {}
    }
  };

  page.on("response", onResponse);

  try {
    const targetUrl = `${BASE}/search/${encodeURIComponent(kw)}`;
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: timeoutMs });

    const startTime = Date.now();
    while (!searchResult && Date.now() - startTime < 8000) {
      await new Promise((r) => setTimeout(r, 400));
    }

    if (searchResult) {
      cacheSet(searchCache, kw.toLowerCase(), searchResult, SEARCH_TTL_MS);
      return searchResult;
    }

    throw new Error("Tidak menerima data dari PDDikti (timeout/kosong).");
  } catch (err) {
    pageErr = err;
    throw pageErr;
  } finally {
    page.off("response", onResponse);
    await stealthBrowser.closePage(page).catch(() => {});
  }
}
