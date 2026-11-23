import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const gitlabCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupGitlab(rawUsername) {
  const username = String(rawUsername || "")
    .trim()
    .replace(/^@/, "");
  if (!username) {
    return { valid: false, reason: "Username GitLab tidak boleh kosong." };
  }

  const cacheKey = username.toLowerCase();
  const cached = gitlabCache.get(cacheKey);
  if (cached) return cached;

  try {
    const list = await request.json(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitLab",
      },
    });

    if (!Array.isArray(list) || list.length === 0) {
      return {
        valid: true,
        exists: false,
        username,
        message: `Pengguna GitLab "${username}" tidak ditemukan.`,
      };
    }

    const user = list[0];
    const result = {
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

    gitlabCache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi GitLab API." };
  }
}
