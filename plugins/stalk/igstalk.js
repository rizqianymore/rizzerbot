import { lookupInstagram } from "@/src/services/osint/igstalk.js";

export default {
  name: "igstalk",
  aliases: ["stalkig", "igprofile", "instagramstalk"],
  description: "Intelijen OSINT profil Instagram (Nama lengkap, jumlah followers, following, total post, avatar HD)",
  usage: "<username instagram>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.-]{1,30})/);
      if (match) input = match[1];
    }

    if (!input) {
      return context.reply(
        `*OSINT INSTAGRAM PROFILE STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}igstalk <username-instagram>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}igstalk instagram\n` +
        `• ${context.prefix || "."}igstalk @zuck`
      );
    }

    await context.sendTyping();

    const res = await lookupInstagram(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN INSTAGRAM PROFILE*`,
      `Username   : @${res.username}`,
      `Nama Akun  : *${res.fullName}*`,
      `Pengikut   : 👥 *${res.followers}* Followers`,
      `Mengikuti  : 👤 *${res.following}* Following`,
      `Total Post : 📸 *${res.posts}* Posts`,
      ``,
      `*Tautan Resmi:*`,
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
