import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const gitPrCache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 200 });

export async function lookupGitPr(username) {
  const clean = String(username || "")
    .trim()
    .replace(/^@/, "");
  if (!clean) {
    return { valid: false, reason: "Username GitHub tidak boleh kosong." };
  }

  const cacheKey = clean.toLowerCase();
  const cached = gitPrCache.get(cacheKey);
  if (cached) return cached;

  try {
    const d = await request.json(
      `https://api.github.com/search/issues?q=author:${encodeURIComponent(clean)}+type:pr&per_page=5`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitPR",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const totalCount = d?.total_count || 0;

    if (totalCount === 0 || !Array.isArray(d?.items)) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Pengembang "${clean}" belum pernah membuat Pull Request publik atau akun tidak ditemukan.`,
      };
    }

    const prs = d.items.slice(0, 5).map((item) => ({
      title: item.title,
      state: item.state,
      createdDate: item.created_at ? item.created_at.split("T")[0] : "-",
      url: item.html_url,
    }));

    const result = {
      valid: true,
      exists: true,
      username: clean,
      totalCount,
      prs,
    };

    gitPrCache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub PR API." };
  }
}
