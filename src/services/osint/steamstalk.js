import https from "node:https";

function fetchSteamXml(targetUrl, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/OSINT-Steam",
          Accept: "text/xml,application/xml,*/*",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve(body);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout saat menghubungi server Steam."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Intelijen Profil Steam Player (Steam XML Public Profile API)
 * @param {string} rawInput - Vanity ID, SteamID64, atau URL profil
 * @returns {Promise<object>}
 */
export async function lookupSteam(rawInput) {
  let target = String(rawInput || "").trim();
  target = target.replace(/^https?:\/\/steamcommunity\.com\/(?:id|profiles)\//i, "").replace(/\/+$/, "").trim();

  if (!target) {
    return { valid: false, reason: "ID atau Custom URL Steam tidak boleh kosong." };
  }

  const isNumericId = /^[0-9]{17}$/.test(target);
  const targetUrl = isNumericId
    ? `https://steamcommunity.com/profiles/${target}/?xml=1`
    : `https://steamcommunity.com/id/${target}/?xml=1`;

  let xml = null;
  try {
    xml = await fetchSteamXml(targetUrl);
  } catch (err) {
    // Fallback via Bright Data Scraping API
    try {
      const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
      if (isBrightDataEnabled()) {
        const bdRes = await brightDataRequest(targetUrl, { format: "raw", timeout: 25000 });
        if (typeof bdRes === "string") xml = bdRes;
      }
    } catch (_) {}
  }

  if (!xml || typeof xml !== "string") {
    return { valid: false, reason: "Gagal mengambil data dari server Steam Community." };
  }

  if (xml.includes("<error>") || !xml.includes("<steamID64>")) {
    return {
      valid: true,
      exists: false,
      target,
      message: `Profil Steam "${target}" tidak ditemukan atau belum pernah dibuat.`,
    };
  }

  const getTag = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return m ? m[1].trim() : "-";
  };

  const steamId64 = getTag("steamID64");
  const steamName = getTag("steamID");
  const onlineState = getTag("onlineState");
  const stateMessage = getTag("stateMessage");
  const privacyState = getTag("privacyState");
  const avatarFull = getTag("avatarFull");
  const vacBanned = getTag("vacBanned") === "1";
  const tradeBanState = getTag("tradeBanState");
  const memberSince = getTag("memberSince");
  const headline = getTag("headline");

  return {
    valid: true,
    exists: true,
    steamId64,
    steamName,
    onlineState,
    stateMessage,
    privacyState,
    avatarFull: avatarFull !== "-" ? avatarFull : null,
    vacBanned,
    tradeBanState,
    memberSince,
    headline: headline !== "-" ? headline : "Tidak ada bio / status.",
    profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
  };
}
