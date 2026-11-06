import axios from "axios";

/**
 * Investigasi Arsip Digital Web Wayback Machine (CDX Server API)
 * Bebas rate-limit 429 dan memberikan data arsip pertama & terakhir
 * @param {string} rawUrl
 * @returns {Promise<object>}
 */
export async function lookupWayback(rawUrl) {
  let target = String(rawUrl || "").trim();
  target = target.replace(/^https?:\/\//i, "").replace(/\/+$/, "").trim();

  if (!target || !target.includes(".")) {
    return {
      valid: false,
      reason: "Domain atau tautan web tidak valid.",
    };
  }

  // CDX API: Ambil arsip pertama dan arsip terkini
  const oldestUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1`;
  const latestUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1&fastLatest=true`;

  let oldestData = null;
  let latestData = null;

  try {
    const [resOld, resNew] = await Promise.all([
      axios.get(oldestUrl, { timeout: 10000 }).catch(() => null),
      axios.get(latestUrl, { timeout: 10000 }).catch(() => null),
    ]);
    oldestData = resOld?.data;
    latestData = resNew?.data;
  } catch (err) {
    // Fallback via Bright Data Scraping API
    try {
      const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
      if (isBrightDataEnabled()) {
        const bdRes = await brightDataRequest(oldestUrl, { format: "json", timeout: 25000 });
        oldestData = typeof bdRes === "string" ? JSON.parse(bdRes) : bdRes;
      }
    } catch (_) {}
  }

  if (!Array.isArray(oldestData) || oldestData.length < 2) {
    return {
      valid: true,
      found: false,
      target,
      message: `Tidak ditemukan rekaman arsip historis untuk "${target}" di Wayback Machine.`,
    };
  }

  // Row format: ["urlkey","timestamp","original","mimetype","statuscode","digest","length"]
  const oldRow = oldestData[1];
  const oldTs = String(oldRow[1] || "");
  const oldUrl = `https://web.archive.org/web/${oldTs}/${oldRow[2] || target}`;

  let newTs = oldTs;
  let newUrl = oldUrl;
  if (Array.isArray(latestData) && latestData.length >= 2) {
    const newRow = latestData[1];
    newTs = String(newRow[1] || "");
    newUrl = `https://web.archive.org/web/${newTs}/${newRow[2] || target}`;
  }

  const formatTs = (ts) => {
    if (ts.length >= 8) {
      return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
    }
    return ts;
  };

  return {
    valid: true,
    found: true,
    target,
    firstArchivedDate: formatTs(oldTs),
    firstArchivedUrl: oldUrl,
    latestArchivedDate: formatTs(newTs),
    latestArchivedUrl: newUrl,
    calendarUrl: `https://web.archive.org/web/*/${target}`,
  };
}
