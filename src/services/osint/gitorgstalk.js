import axios from "axios";

/**
 * Intelijen Organisasi / Perusahaan di GitHub
 * @param {string} orgName
 * @returns {Promise<object>}
 */
export async function lookupGitOrg(orgName) {
  const clean = String(orgName || "").trim().replace(/^@/, "");
  if (!clean) {
    return { valid: false, reason: "Nama organisasi GitHub tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://api.github.com/orgs/${encodeURIComponent(clean)}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-GitOrg",
        Accept: "application/vnd.github.v3+json",
      },
    });

    const d = res.data;
    return {
      valid: true,
      exists: true,
      login: d.login,
      name: d.name || d.login,
      description: d.description || "Tidak ada deskripsi organisasi.",
      blog: d.blog || "-",
      email: d.email || "-",
      publicRepos: d.public_repos || 0,
      followers: d.followers || 0,
      isVerified: d.is_verified || false,
      avatarUrl: d.avatar_url,
      createdDate: d.created_at ? d.created_at.split("T")[0] : "-",
      orgUrl: d.html_url,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Organisasi GitHub "${clean}" tidak ditemukan.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi GitHub Org API." };
  }
}
