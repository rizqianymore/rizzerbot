import axios from "axios";

/**
 * Memeriksa riwayat kebocoran data (data breach) email publik
 * Menggunakan XposedOrNot Public API dengan fallback Bright Data
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function checkEmailBreach(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      valid: false,
      reason: "Format email tidak valid.",
    };
  }

  const targetUrl = `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(cleanEmail)}`;

  let data = null;
  let source = "direct";

  // 1. Coba request langsung
  try {
    const res = await axios.get(targetUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/OSINT-BreachCheck",
        Accept: "application/json",
      },
    });
    data = res.data;
  } catch (err) {
    // 404 pada xposedornot berarti email aman / tidak ditemukan di breach
    if (err.response?.status === 404 || err.response?.data?.Error === "Not found") {
      return {
        valid: true,
        email: cleanEmail,
        breached: false,
        totalBreaches: 0,
        breaches: [],
      };
    }

    // 2. Fallback via Bright Data Scraping bila direct gagal atau diblokir
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
    return {
      valid: true,
      email: cleanEmail,
      breached: false,
      totalBreaches: 0,
      breaches: [],
    };
  }

  // Format array dari XposedOrNot biasanya: { breaches: [ ["Site1", "Site2", ...] ] }
  let breachList = [];
  if (Array.isArray(data?.breaches)) {
    if (Array.isArray(data.breaches[0])) {
      breachList = data.breaches[0];
    } else {
      breachList = data.breaches;
    }
  }

  return {
    valid: true,
    email: cleanEmail,
    breached: breachList.length > 0,
    totalBreaches: breachList.length,
    breaches: breachList,
    source,
  };
}
