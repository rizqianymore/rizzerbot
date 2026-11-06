import axios from "axios";

/**
 * Intelijen Profil Developer & Publisher NPM Registry
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function lookupNpm(username) {
  const clean = String(username || "").trim().toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Username NPM tidak boleh kosong." };
  }

  try {
    const searchUrl = `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(clean)}&size=5`;
    const res = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-NPM" },
    });

    const data = res.data;
    const totalPackages = data.total || 0;

    if (totalPackages === 0 && (!data.objects || data.objects.length === 0)) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Maintainer NPM dengan username "${clean}" tidak ditemukan atau belum menerbitkan package.`,
      };
    }

    const packages = (data.objects || []).map((obj) => ({
      name: obj.package?.name,
      version: obj.package?.version,
      description: obj.package?.description || "-",
      monthlyDownloads: obj.downloads?.monthly || 0,
      npmUrl: obj.package?.links?.npm || `https://www.npmjs.com/package/${obj.package?.name}`,
    }));

    return {
      valid: true,
      exists: true,
      username: clean,
      totalPackages,
      packages,
      profileUrl: `https://www.npmjs.com/~${clean}`,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi NPM Registry." };
  }
}
