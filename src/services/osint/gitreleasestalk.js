import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const gitReleaseCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupGitRelease(rawRepo) {
  let target = String(rawRepo || "").trim();
  target = target
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .trim();

  const parts = target.split("/");
  if (parts.length < 2) {
    return {
      valid: false,
      reason: "Format repo salah. Gunakan format 'owner/repo' (contoh: facebook/react).",
    };
  }

  const owner = parts[0];
  const repo = parts[1];
  const cacheKey = `${owner}/${repo}`.toLowerCase();

  const cached = gitReleaseCache.get(cacheKey);
  if (cached) return cached;

  try {
    const d = await request.json(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitRelease",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const assets = (d?.assets || []).map((a) => ({
      name: a.name,
      downloads: a.download_count || 0,
      sizeMb: (a.size / (1024 * 1024)).toFixed(2),
      downloadUrl: a.browser_download_url,
    }));

    const result = {
      valid: true,
      exists: true,
      repo: `${owner}/${repo}`,
      tagName: d?.tag_name,
      releaseName: d?.name || d?.tag_name,
      author: d?.author?.login || owner,
      publishedDate: d?.published_at ? d.published_at.split("T")[0] : "-",
      body: d?.body ? d.body.slice(0, 150) + "..." : "Tidak ada catatan rilis (changelog).",
      assets,
      htmlUrl: d?.html_url,
    };

    gitReleaseCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Repositori "${owner}/${repo}" tidak memiliki rilis resmi atau bersifat privat.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub Releases API." };
  }
}
