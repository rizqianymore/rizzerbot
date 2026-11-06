import axios from "axios";

/**
 * Intelijen Kontribusi Pull Request & Kode Developer di GitHub
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function lookupGitPr(username) {
  const clean = String(username || "").trim().replace(/^@/, "");
  if (!clean) {
    return { valid: false, reason: "Username GitHub tidak boleh kosong." };
  }

  try {
    const res = await axios.get(
      `https://api.github.com/search/issues?q=author:${encodeURIComponent(clean)}+type:pr&per_page=5`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitPR",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const d = res.data;
    const totalCount = d.total_count || 0;

    if (totalCount === 0 || !Array.isArray(d.items)) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Pengembang "${clean}" belum pernah membuat Pull Request publik atau akun tidak ditemukan.`,
      };
    }

    const prs = d.items.slice(0, 5).map((item) => ({
      title: item.title,
      state: item.state, // open / closed
      createdDate: item.created_at ? item.created_at.split("T")[0] : "-",
      url: item.html_url,
    }));

    return {
      valid: true,
      exists: true,
      username: clean,
      totalCount,
      prs,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub PR API." };
  }
}
