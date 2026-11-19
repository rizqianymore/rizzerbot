import { lookupRoblox } from "@/src/services/osint/robloxstalk.js";

export default {
  name: "robloxstalk",
  aliases: ["roblox", "stalkroblox", "rbxstalk", "robloxuser"],
  description: "Intelijen OSINT profil pemain Roblox (Avatar headshot, user ID, bio, tanggal join, status ban)",
  usage: "<username roblox>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `┌── OSINT ROBLOX PLAYER STALKER\n` +
          `│ Format: ${context.prefix || "."}robloxstalk <username>\n` +
          `└──\n\n` +
          `Contoh: ${context.prefix || "."}robloxstalk Roblox`
      );
    }

    await context.sendTyping();

    const res = await lookupRoblox(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `┌── ROBLOX PLAYER: ${res.username}`,
      `│ Display Name: ${res.displayName}`,
      `│ User ID: ${res.userId}`,
      `│ Tanggal Join: ${res.createdDate}`,
      `│ Status: ${res.isBanned ? "BANNED" : "Aktif"}`,
      `│ Bio: ${res.description || "-"}`,
      `└──\n`,
      `Tautan: ${res.profileUrl}`,
    ].join("\n");

    if (res.avatarUrl && /^https?:\/\//i.test(res.avatarUrl)) {
      try {
        return await sock.sendMessage(
          context.remoteJid,
          {
            image: { url: res.avatarUrl },
            caption,
          },
          { quoted: msg }
        );
      } catch (_) {}
    }

    return context.reply(caption);
  },
};
