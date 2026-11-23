import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const gistCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupGitGists(username) {
  const clean = String(username || "")
    .trim()
    .replace(/^@/, "");
  if (!clean) {
    return { valid: false, reason: "Username GitHub tidak boleh kosong." };
  }

  const cacheKey = clean.toLowerCase();
  const cached = gistCache.get(cacheKey);
  if (cached) return cached;

  try {
    const list = await request.json(`https://api.github.com/users/${encodeURIComponent(clean)}/gists?per_page=5`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-Gist",
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!Array.isArray(list) || list.length === 0) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Pengguna "${clean}" tidak memiliki Gist publik atau akun tidak ditemukan.`,
      };
    }

    const gists = list.map((g) => {
      const files = Object.keys(g.files || {});
      const primaryFile = files[0] || "snippet.txt";
      return {
        id: g.id,
        filename: primaryFile,
        description: g.description || "Tidak ada deskripsi.",
        comments: g.comments || 0,
        url: g.html_url,
        createdDate: g.created_at ? g.created_at.split("T")[0] : "-",
      };
    });

    const result = {
      valid: true,
      exists: true,
      username: clean,
      totalFound: gists.length,
      gists,
      profileUrl: `https://gist.github.com/${clean}`,
    };

    gistCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Pengguna GitHub "${clean}" tidak ditemukan.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub Gist API." };
  }
}
}
