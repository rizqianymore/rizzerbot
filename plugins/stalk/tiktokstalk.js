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
        `*OSINT TIKTOK PROFILE LOOKUP*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}tiktokstalk <username / link tiktok>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}tiktokstalk @khaby.lame\n` +
        `• ${context.prefix || "."}tiktokstalk tiktok`
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
      `*HASIL INTELIJEN TIKTOK*`,
      `Username   : @${res.username}`,
      `Nama Akun  : *${res.authorName}*`,
      `Status     : ✅ Akun Aktif Terverifikasi Sistem`,
      ``,
      `*Tautan Resmi:*`,
      `👉 ${res.profileUrl}`
    ];

    return context.reply(out.join("\n"));
  },
};
