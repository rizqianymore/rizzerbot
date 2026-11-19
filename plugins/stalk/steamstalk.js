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
        `┌── OSINT STEAM GAMER STALKER\n` +
          `│ Format: ${context.prefix || "."}steamstalk <steamid64 / custom URL>\n` +
          `└─\n\n` +
          `Contoh: ${context.prefix || "."}steamstalk gabelogannewell`
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
      `┌── STEAM GAMER: ${res.steamName}`,
      `│ SteamID64: ${res.steamId64}`,
      `│ Status: ${res.onlineState.toUpperCase()} (${res.stateMessage})`,
      `│ Privasi: ${res.privacyState === "public" ? "Publik" : "Terkunci"}`,
      `│ Status VAC: ${res.vacBanned ? "BANNED" : "Bersih"}`,
      `│ Trade Ban: ${res.tradeBanState}`,
      res.memberSince !== "-" ? `│ Sejak: ${res.memberSince}` : "",
      `│ Bio: ${res.headline || "-"}`,
      `└─\n`,
      `Tautan: ${res.profileUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

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
