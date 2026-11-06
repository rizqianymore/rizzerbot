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
        `*OSINT ROBLOX PLAYER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}robloxstalk <username-roblox>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}robloxstalk Roblox\n` +
        `• ${context.prefix || "."}robloxstalk builderman`
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
      `*HASIL INTELIJEN ROBLOX PLAYER*`,
      `Username     : *${res.username}*`,
      `Display Name : ${res.displayName} ${res.hasVerifiedBadge ? "✔ (Verified)" : ""}`,
      `User ID      : \`${res.userId}\``,
      `Tanggal Join : 📅 ${res.createdDate}`,
      `Status Akun  : ${res.isBanned ? "🚨 DIBANNED / SUSPENDED" : "✅ Aktif / Normal"}`,
      ``,
      `*Bio / Deskripsi:*`,
      `${res.description}`,
      ``,
      `*Link Profil Resmi:*`,
      `👉 ${res.profileUrl}`
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
