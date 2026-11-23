import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const waybackCache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 200 });

export async function lookupWayback(rawUrl) {
  let target = String(rawUrl || "").trim();
  target = target
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .trim();

  if (!target || !target.includes(".")) {
    return {
      valid: false,
      reason: "Domain atau tautan web tidak valid.",
    };
  }

  const cached = waybackCache.get(target.toLowerCase());
  if (cached) return cached;

  const oldestUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1`;
  const latestUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=1&fastLatest=true`;

  let oldestData = null;
  let latestData = null;

  try {
    const [resOld, resNew] = await Promise.all([
      request.json(oldestUrl, { timeout: 10000 }).catch(() => null),
      request.json(latestUrl, { timeout: 10000 }).catch(() => null),
    ]);
    oldestData = resOld;
    latestData = resNew;
  } catch (err) {
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

  const result = {
    valid: true,
    found: true,
    target,
    firstArchivedDate: formatTs(oldTs),
    firstArchivedUrl: oldUrl,
    latestArchivedDate: formatTs(newTs),
    latestArchivedUrl: newUrl,
    calendarUrl: `https://web.archive.org/web/*/${target}`,
  };
  waybackCache.set(target.toLowerCase(), result);
  return result;
}
