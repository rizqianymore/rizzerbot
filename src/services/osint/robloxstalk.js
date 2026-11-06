import axios from "axios";
import { createTtlCache } from "@/src/utils/ttl-cache.js";

const robloxCache = createTtlCache({ ttlMs: 15 * 60 * 1000, max: 200 });

/**
 * Stalker Profil Roblox (Official Roblox Users & Thumbnails API)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupRoblox(rawUsername) {
  const username = String(rawUsername || "").trim().replace(/^@/, "");
  if (!username) {
    return { valid: false, reason: "Username Roblox tidak boleh kosong." };
  }

  const cached = robloxCache.get(username.toLowerCase());
  if (cached) return cached;

  try {
    // 1. Dapatkan User ID dari username
    const resId = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      { usernames: [username], excludeBannedUsers: false },
      { timeout: 8000 }
    );

    const userEntry = resId.data?.data?.[0];
    if (!userEntry) {
      return {
        valid: true,
        exists: false,
        username,
        message: `Akun Roblox dengan username "${username}" tidak ditemukan.`,
      };
    }

    const userId = userEntry.id;
    const displayName = userEntry.displayName || userEntry.name;

    // 2. Dapatkan detail profil lengkap & avatar headshot
    const [resProfile, resAvatar] = await Promise.all([
      axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 8000 }).catch(() => null),
      axios.get(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
        { timeout: 8000 }
      ).catch(() => null),
    ]);

    const profileData = resProfile?.data || {};
    const avatarUrl = resAvatar?.data?.data?.[0]?.imageUrl || null;

    let createdDate = "-";
    if (profileData.created) {
      createdDate = profileData.created.split("T")[0];
    }

    const result = {
      valid: true,
      exists: true,
      userId,
      username: userEntry.name,
      displayName,
      isBanned: profileData.isBanned || false,
      hasVerifiedBadge: userEntry.hasVerifiedBadge || false,
      createdDate,
      description: profileData.description || "Tidak ada bio / deskripsi.",
      avatarUrl,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
    };
    robloxCache.set(username.toLowerCase(), result);
    return result;
  } catch (err) {
    return {
      valid: false,
      reason: err.message || "Gagal menghubungi server API Roblox.",
    };
  }
}
