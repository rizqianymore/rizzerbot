import axios from "axios";

/**
 * Intelijen Rilis & Versi Software GitHub (Release Tracker)
 * @param {string} rawRepo - Format "owner/repo" atau link github
 * @returns {Promise<object>}
 */
export async function lookupGitRelease(rawRepo) {
  let target = String(rawRepo || "").trim();
  target = target.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "").trim();

  const parts = target.split("/");
  if (parts.length < 2) {
    return {
      valid: false,
      reason: "Format repo salah. Gunakan format 'owner/repo' (contoh: facebook/react).",
    };
  }

  const owner = parts[0];
  const repo = parts[1];

  try {
    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitRelease",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const d = res.data;
    const assets = (d.assets || []).map((a) => ({
      name: a.name,
      downloads: a.download_count || 0,
      sizeMb: (a.size / (1024 * 1024)).toFixed(2),
      downloadUrl: a.browser_download_url,
    }));

    return {
      valid: true,
      exists: true,
      repo: `${owner}/${repo}`,
      tagName: d.tag_name,
      releaseName: d.name || d.tag_name,
      author: d.author?.login || owner,
      publishedDate: d.published_at ? d.published_at.split("T")[0] : "-",
      body: d.body ? d.body.slice(0, 150) + "..." : "Tidak ada catatan rilis (changelog).",
      assets,
      htmlUrl: d.html_url,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Repositori "${owner}/${repo}" tidak memiliki rilis resmi atau bersifat privat.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub Releases API." };
  }
}
