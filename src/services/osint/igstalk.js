import https from "node:https";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const igCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

function fetchIgHtml(username, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://www.instagram.com/${username}/`,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
      reject(new Error("Timeout saat menghubungi server Instagram."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Intelijen Profil Instagram (Followers, Following, Posts, Bio, Avatar HD)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupInstagram(rawUsername) {
  let username = String(rawUsername || "").trim();
  username = username.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();

  if (!username || !/^[a-zA-Z0-9_.-]{1,30}$/.test(username)) {
    return { valid: false, reason: "Username Instagram tidak valid." };
  }

  const cached = igCache.get(username.toLowerCase());
  if (cached) return cached;

  let html = null;
  try {
    html = await fetchIgHtml(username);
  } catch (err) {
    // Fallback via Bright Data Scraping API
    try {
      const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
      if (isBrightDataEnabled()) {
        const bdRes = await brightDataRequest(`https://www.instagram.com/${username}/`, {
          format: "raw",
          timeout: 25000,
        });
        if (typeof bdRes === "string") html = bdRes;
      }
    } catch (_) {}
  }

  if (!html || typeof html !== "string") {
    return { valid: false, reason: "Gagal mengambil data dari server Instagram." };
  }

  // Parse og:description: "686M Followers, 168 Following, 8,636 Posts - See Instagram photos and videos from Instagram (@instagram)"
  const descMatch = html.match(/property="og:description"\s+content="([^"]+)"/i) ||
                    html.match(/name="description"\s+content="([^"]+)"/i);
  const ogDesc = descMatch ? descMatch[1] : null;

  if (!ogDesc || html.includes("Sorry, this page isn't available.")) {
    return {
      valid: true,
      exists: false,
      username,
      message: `Akun Instagram @${username} tidak ditemukan atau dinonaktifkan.`,
    };
  }

  // Parse title: "Instagram (@instagram) • Instagram photos and videos"
  const titleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i);
  let fullName = username;
  if (titleMatch) {
    const rawTitle = titleMatch[1];
    const namePart = rawTitle.split(/[\(\•]/)[0].trim();
    if (namePart) fullName = namePart;
  }

  // Parse stats dari ogDesc
  let followers = "-";
  let following = "-";
  let posts = "-";

  const statsMatch = ogDesc.match(/([\d\.,KMkm]+)\s*Followers,\s*([\d\.,KMkm]+)\s*Following,\s*([\d\.,KMkm]+)\s*Posts/i);
  if (statsMatch) {
    followers = statsMatch[1];
    following = statsMatch[2];
    posts = statsMatch[3];
  }

  // Parse Avatar URL
  const imgMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
  let avatarUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, "&") : null;

  const result = {
    valid: true,
    exists: true,
    username,
    fullName,
    followers,
    following,
    posts,
    avatarUrl,
    profileUrl: `https://www.instagram.com/${username}/`,
  };
  igCache.set(username.toLowerCase(), result);
  return result;
}
