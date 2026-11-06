import axios from "axios";

/**
 * Intelijen Profil Tokoh, Publik Figur, & Entitas dari Ensiklopedia Wikipedia (ID & EN)
 * @param {string} query
 * @param {string} [lang] - "id" atau "en"
 * @returns {Promise<object>}
 */
export async function lookupWiki(query, lang = "id") {
  const clean = String(query || "").trim();
  if (!clean) {
    return { valid: false, reason: "Nama tokoh atau entitas yang dicari tidak boleh kosong." };
  }

  const langCode = lang === "en" ? "en" : "id";
  const apiUrl = `https://${langCode}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(clean)}&pithumbsize=400&format=json&redirects=1`;

  try {
    const res = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-Wiki" },
    });

    const pages = res.data?.query?.pages || {};
    const pageId = Object.keys(pages)[0];

    if (!pageId || pageId === "-1") {
      // Coba fallback ke bahasa Inggris bila di ID tidak ada
      if (langCode === "id") {
        return lookupWiki(query, "en");
      }
      return {
        valid: true,
        exists: false,
        query: clean,
        message: `Biografi atau profil untuk "${clean}" tidak ditemukan di basis data Wikipedia.`,
      };
    }

    const page = pages[pageId];
    const title = page.title;
    const extract = page.extract ? page.extract.slice(0, 450) + "..." : "Tidak ada ringkasan biografi.";
    const avatarUrl = page.thumbnail?.source || null;

    return {
      valid: true,
      exists: true,
      title,
      extract,
      avatarUrl,
      wikiUrl: `https://${langCode}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi Wikipedia API." };
  }
}
