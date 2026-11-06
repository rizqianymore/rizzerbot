import { lookupScratch } from "@/src/services/osint/scratchstalk.js";

export default {
  name: "scratchstalk",
  aliases: ["scratch", "stalkscratch", "scratchuser"],
  description: "Intelijen OSINT profil kreator Scratch MIT (Game developer, bio, negara, tanggal join)",
  usage: "<username scratch>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT SCRATCH DEVELOPER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}scratchstalk <username-scratch>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}scratchstalk griffpatch\n` +
        `• ${context.prefix || "."}scratchstalk Will_Wam`
      );
    }

    await context.sendTyping();

    const res = await lookupScratch(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN SCRATCH CREATOR*`,
      `Username     : *${res.username}*`,
      `User ID      : \`${res.userId}\``,
      `Asal Negara  : 🌍 ${res.country}`,
      `Tanggal Join : 📅 ${res.joined}`,
      ``,
      `*Bio Kreator:*`,
      `${res.bio}`,
      ``,
      `*Aktivitas Terkini:*`,
      `${res.status}`,
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
