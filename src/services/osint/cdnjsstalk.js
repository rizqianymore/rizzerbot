import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const cdnjsCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupCdnjs(libName) {
  const clean = String(libName || "")
    .trim()
    .toLowerCase();
  if (!clean) {
    return { valid: false, reason: "Nama library CDNJS tidak boleh kosong." };
  }

  const cached = cdnjsCache.get(clean);
  if (cached) return cached;

  try {
    const d = await request.json(`https://api.cdnjs.com/libraries/${encodeURIComponent(clean)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-CDNJS" },
    });

    if (!d?.name) {
      return {
        valid: true,
        exists: false,
        message: `Library "${clean}" tidak ditemukan di CDNJS.`,
      };
    }

    const result = {
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

    cdnjsCache.set(clean, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        message: `Library "${clean}" tidak ditemukan di database CDNJS.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi CDNJS API." };
  }
}
