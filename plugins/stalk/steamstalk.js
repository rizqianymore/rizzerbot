import { lookupSteam } from "@/src/services/osint/steamstalk.js";

export default {
  name: "steamstalk",
  aliases: ["steam", "stalksteam", "steamprofile", "steamuser"],
  description: "Intelijen OSINT pemain game Steam (SteamID64, status VAC Ban, avatar HD, Trade Ban, status online)",
  usage: "<custom URL / steamID64>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT STEAM PLAYER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}steamstalk <custom-url / steamid64 / link-profil>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}steamstalk gabelogannewell\n` +
        `• ${context.prefix || "."}steamstalk 76561197960287930\n` +
        `• ${context.prefix || "."}steamstalk https://steamcommunity.com/id/dendi`
      );
    }

    await context.sendTyping();

    const res = await lookupSteam(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN STEAM GAMER*`,
      `Nama Akun    : *${res.steamName}*`,
      `SteamID64    : \`${res.steamId64}\``,
      `Status Online: *${res.onlineState.toUpperCase()}* (${res.stateMessage})`,
      `Privasi Akun : ${res.privacyState === "public" ? "🌐 Publik" : "🔒 Terkunci / Friendsonly"}`,
      `Status VAC   : ${res.vacBanned ? "🚨 TERKENA VAC BAN!" : "✅ Bersih (No VAC Ban)"}`,
      `Trade Ban    : ${res.tradeBanState}`,
      res.memberSince !== "-" ? `Member Sejak : 📅 ${res.memberSince}` : "",
      ``,
      `*Status / Headline:*`,
      `${res.headline}`,
      ``,
      `*Link Profil Resmi:*`,
      `👉 ${res.profileUrl}`
    ].filter(Boolean).join("\n");

    if (res.avatarFull && /^https?:\/\//i.test(res.avatarFull)) {
      try {
        return await sock.sendMessage(
          context.remoteJid,
          {
            image: { url: res.avatarFull },
            caption,
          },
          { quoted: msg }
        );
      } catch (_) {}
    }

    return context.reply(caption);
  },
};
