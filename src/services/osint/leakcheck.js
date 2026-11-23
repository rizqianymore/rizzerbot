import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const breachCache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 200 });

export async function checkEmailBreach(email) {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      valid: false,
      reason: "Format email tidak valid.",
    };
  }

  const cached = breachCache.get(cleanEmail);
  if (cached) return cached;

  const targetUrl = `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(cleanEmail)}`;

  let data = null;
  let source = "direct";

  try {
    data = await request.json(targetUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/OSINT-BreachCheck",
        Accept: "application/json",
      },
    });
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404 || err.response?.data?.Error === "Not found") {
      const notFoundResult = {
        valid: true,
        email: cleanEmail,
        breached: false,
        totalBreaches: 0,
        breaches: [],
      };
      breachCache.set(cleanEmail, notFoundResult);
      return notFoundResult;
    }

    try {
      const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
      if (isBrightDataEnabled()) {
        const bdRes = await brightDataRequest(targetUrl, {
          format: "json",
          timeout: 25000,
        });
        data = typeof bdRes === "string" ? JSON.parse(bdRes) : bdRes;
        source = "brightdata";
      }
    } catch (_) {}
  }

  if (!data) {
    return {
      valid: true,
      email: cleanEmail,
      breached: false,
      totalBreaches: 0,
      breaches: [],
    };
  }

  if (data?.Error === "Not found" || (data?.status && data.status !== "success")) {
    const notFoundResult = {
      valid: true,
      email: cleanEmail,
      breached: false,
      totalBreaches: 0,
      breaches: [],
    };
    breachCache.set(cleanEmail, notFoundResult);
    return notFoundResult;
  }

  let breachList = [];
  if (Array.isArray(data?.breaches)) {
    if (Array.isArray(data.breaches[0])) {
      breachList = data.breaches[0];
    } else {
      breachList = data.breaches;
    }
  }

  const result = {
    valid: true,
    email: cleanEmail,
    breached: breachList.length > 0,
    totalBreaches: breachList.length,
    breaches: breachList,
    source,
  };
  breachCache.set(cleanEmail, result);
  return result;
}
