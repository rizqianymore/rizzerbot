import { isValidUsername } from "@/src/services/osint/userhunt.js";

function fetchTimeout(url, opts = {}, ms = 8000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(id));
}

export default {
  name: "stalkall",
  aliases: ["cekall", "checkall", "stalksemua", "fullstalk", "stalkprofile"],
  description: "Stalking profil lengkap username di berbagai platform online",
  usage: "<username>",
  category: "Stalker",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(
        `📝 *Usage:* \`${currentPrefix}stalkall <username>\`\n💡 Contoh: \`${currentPrefix}stalkall knay\``
      );
    }

    if (!isValidUsername(username)) {
      return reply(
        `❌ *Format username tidak valid!*\n\n` +
          `• Panjang 3-30 karakter\n` +
          `• Hanya huruf, angka, underscore (_), titik (.), atau dash (-)`
      );
    }

    await sendTyping();
    await reply(`🔍 Sedang mengumpulkan informasi & profil lengkap untuk *${username}*... Mohon tunggu.`);

    const u = encodeURIComponent(username);
    const uRaw = username;

    const tasks = [
      // 1. GitHub
      fetchTimeout(`https://api.github.com/users/${u}`, { headers: { "User-Agent": "Mozilla/5.0" } })
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.login) return null;
          return {
            platform: "GitHub",
            url: `https://github.com/${uRaw}`,
            name: d.name || d.login,
            avatar: d.avatar_url,
            bio: d.bio || "",
            company: d.company || "",
            location: d.location || "",
            details: [
              d.name ? `Nama: ${d.name}` : null,
              `Public Repos: ${d.public_repos ?? 0}`,
              `Followers: ${d.followers ?? 0} | Following: ${d.following ?? 0}`,
              d.company ? `Perusahaan: ${d.company}` : null,
              d.location ? `Lokasi: ${d.location}` : null,
              d.created_at ? `Joined: ${d.created_at.slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 2. TikTok
      fetchTimeout(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${u}`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.author_name) return null;
          return {
            platform: "TikTok",
            url: `https://www.tiktok.com/@${uRaw}`,
            name: d.author_name,
            details: [`Display Name: ${d.author_name}`, `Profile Type: Verified / Creator Profile`],
          };
        })
        .catch(() => null),

      // 3. Steam
      fetchTimeout(`https://steamcommunity.com/id/${u}/?xml=1`)
        .then((r) => (r.status === 200 ? r.text() : null))
        .then((xml) => {
          if (!xml || !xml.includes("<steamID64>")) return null;
          const getTag = (t) => {
            const m = xml.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${t}>`));
            return m ? m[1].trim() : "";
          };
          const steamName = getTag("steamID");
          const state = getTag("onlineState") || "offline";
          const joined = getTag("memberSince");
          const avatar = getTag("avatarFull");
          const headline = getTag("headline");
          return {
            platform: "Steam",
            url: `https://steamcommunity.com/id/${uRaw}`,
            name: steamName || uRaw,
            avatar,
            bio: headline,
            details: [
              steamName ? `Nickname: ${steamName}` : null,
              `Status: ${state}`,
              joined ? `Member Since: ${joined}` : null,
              getTag("steamID64") ? `SteamID64: ${getTag("steamID64")}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 4. Roblox
      fetchTimeout("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [uRaw], excludeBannedUsers: false }),
      })
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          const hit = d?.data?.[0];
          if (!hit?.id) return null;
          return {
            platform: "Roblox",
            url: `https://www.roblox.com/users/${hit.id}/profile`,
            name: hit.displayName || hit.name,
            details: [`Username: ${hit.name}`, `Display: ${hit.displayName}`, `Player ID: ${hit.id}`],
          };
        })
        .catch(() => null),

      // 5. Chess.com
      fetchTimeout(`https://api.chess.com/pub/player/${u}`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.username) return null;
          const country = d.country ? d.country.split("/").pop() : null;
          return {
            platform: "Chess.com",
            url: `https://www.chess.com/member/${uRaw}`,
            name: d.name || d.username,
            avatar: d.avatar,
            details: [
              d.name ? `Nama: ${d.name}` : null,
              `Status: ${d.status || "active"}`,
              `Followers: ${d.followers ?? 0}`,
              country ? `Negara: ${country}` : null,
              d.joined ? `Joined: ${new Date(d.joined * 1000).toISOString().slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 6. Lichess
      fetchTimeout(`https://lichess.org/api/user/${u}`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.username) return null;
          const p = d.perfs || {};
          return {
            platform: "Lichess",
            url: `https://lichess.org/@/${uRaw}`,
            name: d.username,
            bio: d.bio,
            details: [
              `Total Games: ${d.count?.all ?? 0}`,
              p.blitz?.rating ? `Blitz Rating: ${p.blitz.rating}` : null,
              p.rapid?.rating ? `Rapid Rating: ${p.rapid.rating}` : null,
              p.bullet?.rating ? `Bullet Rating: ${p.bullet.rating}` : null,
              d.createdAt ? `Created: ${new Date(d.createdAt).toISOString().slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 7. Docker Hub
      fetchTimeout(`https://hub.docker.com/v2/users/${u}/`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.username) return null;
          return {
            platform: "Docker Hub",
            url: `https://hub.docker.com/u/${uRaw}`,
            name: d.full_name || d.username,
            details: [
              d.full_name ? `Nama: ${d.full_name}` : null,
              `Tipe: ${d.type || "User"}`,
              d.location ? `Lokasi: ${d.location}` : null,
              d.company ? `Organisasi: ${d.company}` : null,
              d.date_joined ? `Joined: ${d.date_joined.slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 8. Dev.to
      fetchTimeout(`https://dev.to/api/users/by_username?url=${u}`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.username) return null;
          return {
            platform: "Dev.to",
            url: `https://dev.to/${uRaw}`,
            name: d.name || d.username,
            avatar: d.profile_image,
            bio: d.summary,
            details: [
              d.name ? `Nama: ${d.name}` : null,
              d.location ? `Lokasi: ${d.location}` : null,
              d.joined_at ? `Joined: ${d.joined_at.slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),

      // 9. Hacker News
      fetchTimeout(`https://hacker-news.firebaseio.com/v0/user/${u}.json`)
        .then((r) => (r.status === 200 ? r.json() : null))
        .then((d) => {
          if (!d || !d.id) return null;
          return {
            platform: "Hacker News",
            url: `https://news.ycombinator.com/user?id=${uRaw}`,
            name: d.id,
            bio: d.about ? d.about.replace(/<[^>]+>/g, " ").slice(0, 150) : "",
            details: [
              `Karma: ${d.karma ?? 0}`,
              d.created ? `Joined: ${new Date(d.created * 1000).toISOString().slice(0, 10)}` : null,
            ].filter(Boolean),
          };
        })
        .catch(() => null),
    ];

    const profiles = (await Promise.all(tasks)).filter(Boolean);

    if (profiles.length === 0) {
      return reply(
        `❌ *Profil tidak ditemukan!*\n\n` +
          `Username \`${username}\` tidak memiliki akun publik aktif di platform populer yang diperiksa (GitHub, TikTok, Steam, Chess, Lichess, Docker, Roblox, Dev.to, HN).\n` +
          `Gunakan \`${currentPrefix}userhunt ${username}\` untuk memindai ke 18+ platform lainnya.`
      );
    }

    const lines = [
      `🌐 *STALKER INFORMASI LENGKAP*`,
      `Target: \`${username}\``,
      `Ditemukan: *${profiles.length} platform* dengan profil aktif\n`,
    ];

    profiles.forEach((p, i) => {
      lines.push(`${i + 1}. *[${p.platform}]* ${p.name}`);
      lines.push(`   🔗 ${p.url}`);
      if (p.details && p.details.length > 0) {
        lines.push(`   📊 ${p.details.join(" | ")}`);
      }
      if (p.bio) {
        lines.push(`   💬 _"${p.bio.trim().replace(/\n+/g, " ")}"_`);
      }
      lines.push("");
    });

    lines.push(`_Gunakan perintah spesifik seperti \`${currentPrefix}githubstalk\`, \`${currentPrefix}robloxstalk\`, dsb untuk detail mendalam._`);

    const primaryAvatar = profiles.find((p) => p.avatar)?.avatar;
    if (primaryAvatar && /^https?:\/\//i.test(primaryAvatar)) {
      try {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url: primaryAvatar }, caption: lines.join("\n") },
          { quoted: msg }
        );
        return;
      } catch (_) {}
    }

    return reply(lines.join("\n"));
  },
};