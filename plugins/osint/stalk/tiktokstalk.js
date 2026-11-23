import { lookupTiktok } from "@/src/services/osint/tiktokstalk.js";

export default {
  name: "tiktokstalk",
  aliases: ["ttstalk", "stalktt", "tiktokprofile"],
  description: "Intelijen OSINT profil akun TikTok (Nama kreator, status aktif, dan verifikasi profil)",
  usage: "<username / link tiktok>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/(?:tiktok\.com\/@|@)([a-zA-Z0-9_.-]{2,32})/);
      if (match) input = match[1];
    }

    if (!input) {
      return context.reply(
        `┌── OSINT TIKTOK STALKER\n` +
          `│ Format: ${context.prefix || "."}tiktokstalk <username>\n` +
          `└─\n\n` +
          `Contoh: ${context.prefix || "."}tiktokstalk @khaby.lame`
      );
    }

    await context.sendTyping();

    const res = await lookupTiktok(input);
    if (!res.valid) {
      return context.reply(`Format salah: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `┌── TIKTOK PROFILE: @${res.username}`,
      `│ Nama: ${res.authorName}`,
      `│ Status: Akun Aktif Terverifikasi`,
      `└─\n`,
      `Tautan: ${res.profileUrl}`,
    ];

    return context.reply(out.join("\n"));
  },
};
