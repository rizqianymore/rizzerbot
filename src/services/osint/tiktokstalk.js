import axios from "axios";

/**
 * Intelijen Profil TikTok (oEmbed Official API + Bright Data Scraping Fallback)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupTiktok(rawUsername) {
  let username = String(rawUsername || "").trim();
  username = username.replace(/^https?:\/\/(?:www\.)?tiktok\.com\/@?/i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();

  if (!username || !/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return {
      valid: false,
      reason: "Username TikTok tidak valid (harus 2-32 karakter alfanumerik / titik / underscore).",
    };
  }

  const profileUrl = `https://www.tiktok.com/@${username}`;
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`;

  let oembedData = null;
  try {
    const res = await axios.get(oembedUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/OSINT-TikTok",
      },
    });
    oembedData = res.data;
  } catch (_) {}

  if (!oembedData || oembedData.code === 400 || !oembedData.author_name) {
    return {
      valid: true,
      exists: false,
      username,
      message: `Akun TikTok @${username} tidak ditemukan atau bersifat privat.`,
    };
  }

  const authorName = oembedData.author_name || username;
  const authorUrl = oembedData.author_url || profileUrl;
  const embedTitle = oembedData.title || `${authorName}'s Profile`;

  return {
    valid: true,
    exists: true,
    username,
    authorName,
    embedTitle,
    profileUrl: authorUrl,
  };
}
