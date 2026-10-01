// plugins/stalker/robloxstalk.js — perintah "robloxstalk" (TANPA API key).
// Backend: Roblox Public API (users/friends/thumbnails) — pengganti JereAPI yang sudah tidak ada.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

async function getJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA, ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`Roblox API HTTP ${res.status}`);
  return res.json();
}

async function resolveUserId(input) {
  // Input angka = langsung ID; selain itu lookup username -> ID
  if (/^\d+$/.test(input)) return Number(input);
  const data = await getJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [input], excludeBannedUsers: false }),
  });
  const found = data?.data?.[0];
  if (!found?.id) throw new Error(`Pemain Roblox "${input}" tidak ditemukan`);
  return found.id;
}

const PRESENCE_LABEL = ["Offline", "Online", "In-Game", "Di Studio"];

export default {
  name: "robloxstalk",
  aliases: ["stalkroblox", "roblox", "rblxstalk"],
  description: "Intip profil Roblox: bio, followers, presence, avatar (gratis)",
  usage: "<username / ID, cth: builderman>",
  premiumOnly: false,
  category: "Stalker",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const input = args.join(" ").trim();
    if (!input) {
      return reply(
        `*ROBLOX STALKER*\n\n` +
        `Penggunaan: *${prefix}robloxstalk <username / ID>*\n` +
        `Contoh: *${prefix}robloxstalk builderman*`
      );
    }

    const clean = input
      .replace(/^https?:\/\/(www\.)?roblox\.com\/(users|player)\/(\d+)\/profile/i, "$3")
      .split("/")[0]
      .trim();

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🕕");

    try {
      const userId = await resolveUserId(clean);
      const [profile, followers, followings, friends, avatar, presence] = await Promise.all([
        getJson(`https://users.roblox.com/v1/users/${userId}`),
        getJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`).catch(() => ({})),
        getJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`).catch(() => ({})),
        getJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`).catch(() => ({})),
        getJson(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        ).catch(() => ({})),
        getJson("https://presence.roblox.com/v1/presence/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: [userId] }),
        }).catch(() => ({})),
      ]);

      if (!profile?.name) throw new Error("Pemain Roblox tidak ditemukan");

      const accountAgeDays = profile.created
        ? Math.max(0, Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000))
        : 0;
      const presenceInfo = presence?.userPresences?.[0];
      const presenceLabel =
        typeof presenceInfo?.userPresenceType === "number"
          ? PRESENCE_LABEL[presenceInfo.userPresenceType] || "Unknown"
          : "Unknown";
      const lastLocation =
        presenceInfo?.lastLocation && presenceInfo.lastLocation !== "Website"
          ? ` (${presenceInfo.lastLocation})`
          : "";

      let card = `*ROBLOX STALKER*\n`;
      card += `Username: ${profile.name}\n`;
      card += `Display Name: ${profile.displayName || profile.name}\n`;
      card += `Player ID: ${profile.id ?? userId}\n`;
      if (profile.description) {
        const bio =
          profile.description.length > 250
            ? profile.description.slice(0, 250) + "..."
            : profile.description;
        card += `Bio: ${bio}\n`;
      }
      card += `Followers: ${(followers.count ?? 0).toLocaleString("id-ID")}\n`;
      card += `Following: ${(followings.count ?? 0).toLocaleString("id-ID")}\n`;
      card += `Friends: ${(friends.count ?? 0).toLocaleString("id-ID")}\n`;
      card += `Verified: ${profile.hasVerifiedBadge ? "Ya" : "Tidak"}\n`;
      card += `Joined: ${formatDate(profile.created)} (${Math.floor(accountAgeDays / 365)} thn)\n`;
      card += `Presence: ${presenceLabel}${lastLocation}\n`;
      card += `Status: ${profile.isBanned ? "Banned" : "Aktif"}\n`;
      card += `Link: https://www.roblox.com/users/${profile.id ?? userId}/profile`;

      const avatarImg = avatar?.data?.[0]?.imageUrl;
      if (avatarImg && avatarImg.startsWith("http")) {
        try {
          await sock.sendMessage(
            msg.key.remoteJid,
            { image: { url: avatarImg }, caption: card },
            { quoted: msg }
          );
        } catch {
          await reply(card);
        }
      } else {
        await reply(card);
      }
      await react("✅");
    } catch (err) {
      await react("❌");
      await reply(`*ROBLOX STALKER GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
