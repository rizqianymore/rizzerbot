import { request } from "@/src/utils/request.js";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const scratchCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

export async function lookupScratch(username) {
  const clean = String(username || "").trim();
  if (!clean) {
    return { valid: false, reason: "Username Scratch tidak boleh kosong." };
  }

  const cacheKey = clean.toLowerCase();
  const cached = scratchCache.get(cacheKey);
  if (cached) return cached;

  try {
    const userUrl = `https://api.scratch.mit.edu/users/${encodeURIComponent(clean)}`;
    const data = await request.json(userUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-Scratch" },
    });

    if (!data?.id) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Kreator Scratch dengan username "${clean}" tidak ditemukan.`,
      };
    }

    const userId = data.id;
    const joined = data.history?.joined ? data.history.joined.split("T")[0] : "-";
    const country = data.profile?.country || "-";
    const bio = data.profile?.bio || "Tidak ada bio.";
    const status = data.profile?.status || "Tidak ada status.";
    const avatarUrl = data.profile?.images?.["90x90"] || null;

    const result = {
      valid: true,
      exists: true,
      userId,
      username: data.username,
      joined,
      country,
      bio,
      status,
      avatarUrl,
      profileUrl: `https://scratch.mit.edu/users/${data.username}/`,
    };

    scratchCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.status === 404 || err.response?.status === 404) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Kreator Scratch "${clean}" tidak ditemukan.`,
      };
    }
    return { valid: false, reason: err.message || "Gagal menghubungi Scratch API." };
  }
}
