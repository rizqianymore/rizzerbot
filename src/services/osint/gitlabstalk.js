import axios from "axios";

/**
 * Intelijen Profil Pengguna & Developer GitLab (GitLab Community API v4)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupGitlab(rawUsername) {
  const username = String(rawUsername || "").trim().replace(/^@/, "");
  if (!username) {
    return { valid: false, reason: "Username GitLab tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitLab",
      },
    });

    const list = res.data;
    if (!Array.isArray(list) || list.length === 0) {
      return {
        valid: true,
        exists: false,
        username,
        message: `Pengguna GitLab "${username}" tidak ditemukan.`,
      };
    }

    const user = list[0];
    return {
      valid: true,
      exists: true,
      userId: user.id,
      username: user.username,
      name: user.name,
      state: user.state,
      isLocked: user.locked || false,
      avatarUrl: user.avatar_url,
      profileUrl: user.web_url,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi GitLab API." };
  }
}
