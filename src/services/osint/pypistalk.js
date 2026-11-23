import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const pypiCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupPypi(packageName) {
  const clean = String(packageName || "")
    .trim()
    .toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Nama paket PyPI tidak boleh kosong." };
  }

  const cached = pypiCache.get(clean);
  if (cached) return cached;

  try {
    const d = await request.json(`https://pypi.org/pypi/${encodeURIComponent(clean)}/json`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-PyPI" },
    });

    const info = d?.info || {};

    const result = {
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

    pypiCache.set(clean, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Paket Python "${clean}" tidak ditemukan di PyPI.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi PyPI API." };
  }
}
