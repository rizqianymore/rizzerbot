import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const gitRepoCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupGitRepo(rawRepo) {
  let target = String(rawRepo || "").trim();
  target = target
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .trim();

  const parts = target.split("/");
  if (parts.length < 2) {
    return {
      valid: false,
      reason: "Format repo salah. Gunakan format 'owner/repo' (contoh: torvalds/linux).",
    };
  }

  const owner = parts[0];
  const repo = parts[1];
  const cacheKey = `${owner}/${repo}`.toLowerCase();

  const cached = gitRepoCache.get(cacheKey);
  if (cached) return cached;

  try {
    const d = await request.json(`https://api.github.com/repos/${owner}/${repo}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitRepo",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const result = {
      valid: true,
      exists: true,
      fullName: d?.full_name,
      owner: d?.owner?.login,
      ownerAvatar: d?.owner?.avatar_url,
      description: d?.description || "Tidak ada deskripsi repositori.",
      stars: d?.stargazers_count || 0,
      forks: d?.forks_count || 0,
      watchers: d?.watchers_count || 0,
      openIssues: d?.open_issues_count || 0,
      language: d?.language || "Multi-language",
      license: d?.license?.name || "Tidak ada lisensi resmi",
      defaultBranch: d?.default_branch || "main",
      createdDate: d?.created_at?.split("T")[0] || "-",
      updatedDate: d?.updated_at?.split("T")[0] || "-",
      repoUrl: d?.html_url,
    };

    gitRepoCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Repositori "${owner}/${repo}" tidak ditemukan atau bersifat privat.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub API." };
  }
}
