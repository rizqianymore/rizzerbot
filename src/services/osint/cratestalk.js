import axios from "axios";

/**
 * Intelijen Crate / Paket Bahasa Rust di Crates.io
 * @param {string} crateName
 * @returns {Promise<object>}
 */
export async function lookupCrates(crateName) {
  const clean = String(crateName || "").trim().toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Nama crate tidak boleh kosong." };
  }

  try {
    const res = await axios.get(`https://crates.io/api/v1/crates/${encodeURIComponent(clean)}`, {
      timeout: 10000,
      headers: { "User-Agent": "RizzerBot/OSINT-Crates (contact@rizzerbot.local)" },
    });

    const d = res.data?.crate;
    if (!d?.id) {
      return {
        valid: true,
        exists: false,
        message: `Crate Rust "${clean}" tidak ditemukan di Crates.io.`,
      };
    }

    return {
      valid: true,
      exists: true,
      name: d.name,
      version: d.max_version || d.default_version,
      description: d.description || "Tidak ada deskripsi crate.",
      downloads: d.downloads || 0,
      recentDownloads: d.recent_downloads || 0,
      homepage: d.homepage || `https://crates.io/crates/${d.name}`,
      repository: d.repository || "-",
      documentation: d.documentation || `https://docs.rs/${d.name}`,
      createdDate: d.created_at ? d.created_at.split("T")[0] : "-",
      crateUrl: `https://crates.io/crates/${d.name}`,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Crate Rust "${clean}" tidak ditemukan di Crates.io.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi Crates.io API." };
  }
}
