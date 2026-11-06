import axios from "axios";

/**
 * Intelijen Profil Grandmaster & Pemain Catur Lichess (Official Lichess API)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupLichess(rawUsername) {
  const username = String(rawUsername || "").trim().replace(/^@/, "");
  if (!username) {
    return { valid: false, reason: "Username Lichess tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://lichess.org/api/user/${encodeURIComponent(username)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-Lichess", Accept: "application/json" },
    });

    const d = res.data;
    if (!d?.id) {
      return {
        valid: true,
        exists: false,
        username,
        message: `Pemain Lichess "${username}" tidak ditemukan.`,
      };
    }

    const title = d.title ? `[${d.title}] ` : "";
    const perfs = d.perfs || {};
    const bullet = perfs.bullet?.rating || "-";
    const blitz = perfs.blitz?.rating || "-";
    const rapid = perfs.rapid?.rating || "-";
    const classical = perfs.classical?.rating || "-";

    const totalGames = d.count?.all || 0;
    const wins = d.count?.win || 0;
    const losses = d.count?.loss || 0;
    const draws = d.count?.draw || 0;

    let createdDate = "-";
    if (d.createdAt) {
      createdDate = new Date(d.createdAt).toISOString().split("T")[0];
    }

    return {
      valid: true,
      exists: true,
      username: d.username,
      title,
      totalGames,
      wins,
      losses,
      draws,
      bullet,
      blitz,
      rapid,
      classical,
      createdDate,
      profileUrl: d.url || `https://lichess.org/@/${d.username}`,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        username,
        message: `Pemain Lichess "${username}" tidak ditemukan.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi Lichess API." };
  }
}
