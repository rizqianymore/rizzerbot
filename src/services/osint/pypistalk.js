import axios from "axios";

/**
 * Intelijen Paket Python PyPI Registry (Python Software Foundation)
 * @param {string} packageName
 * @returns {Promise<object>}
 */
export async function lookupPypi(packageName) {
  const clean = String(packageName || "").trim().toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Nama paket PyPI tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://pypi.org/pypi/${encodeURIComponent(clean)}/json`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-PyPI" },
    });

    const d = res.data;
    const info = d.info || {};

    return {
      valid: true,
      exists: true,
      name: info.name,
      version: info.version,
      summary: info.summary || info.description?.slice(0, 150) || "Tidak ada deskripsi singkat.",
      author: info.author || info.author_email || "Anonim",
      license: info.license || "Open Source",
      homePage: info.home_page || info.project_urls?.Homepage || `https://pypi.org/project/${info.name}/`,
      packageUrl: info.package_url || `https://pypi.org/project/${info.name}/`,
      requiresPython: info.requires_python || "Python 3+",
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Paket Python "${clean}" tidak ditemukan di PyPI.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi PyPI API." };
  }
}
