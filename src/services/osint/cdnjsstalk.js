import axios from "axios";

/**
 * Intelijen Library Web CDNJS (Cloudflare CDNJS API)
 * @param {string} libName
 * @returns {Promise<object>}
 */
export async function lookupCdnjs(libName) {
  const clean = String(libName || "").trim().toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Nama library CDNJS tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://api.cdnjs.com/libraries/${encodeURIComponent(clean)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-CDNJS" },
    });

    const d = res.data;
    if (!d?.name) {
      return {
        valid: true,
        exists: false,
        message: `Library "${clean}" tidak ditemukan di CDNJS.`,
      };
    }

    return {
      valid: true,
      exists: true,
      name: d.name,
      version: d.version,
      description: d.description || "Tidak ada deskripsi library.",
      latestCdnUrl: d.latest,
      homepage: d.homepage || `https://cdnjs.com/libraries/${d.name}`,
      license: d.license || "Open Source",
      repository: d.repository?.url || "-",
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Library "${clean}" tidak ditemukan di database CDNJS.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi CDNJS API." };
  }
}
