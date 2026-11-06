import { lookupTelegram } from "@/src/services/osint/telegram.js";

export default {
  name: "tgstalk",
  aliases: ["tglookup", "telegramstalk", "tginfo", "teleosint"],
  description: "Intelijen OSINT Telegram (Profil pengguna, supergroup, channel, bot, dan avatar HD)",
  usage: "<username / link t.me>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/(?:t\.me\/|@)([a-zA-Z0-9_]{3,32})/);
      if (match) input = match[1];
    }

    if (!input) {
      return context.reply(
        `*OSINT TELEGRAM INTELLIGENCE*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}tgstalk <username / link t.me>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}tgstalk @durov\n` +
        `• ${context.prefix || "."}tgstalk https://t.me/BotFather\n` +
        `• ${context.prefix || "."}tgstalk telegram`
      );
    }

    await context.sendTyping();

    const res = await lookupTelegram(input);
    if (!res.valid) {
      return context.reply(`Format salah: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN TELEGRAM*`,
      `Username   : @${res.username}`,
      `Nama/Title : *${res.title}*`,
      `Tipe Akun  : ${res.entityType}`,
      `Statistik  : ${res.extra}`,
      ``,
      `*Bio / Deskripsi:*`,
      `${res.description}`,
      ``,
      `*Link Publik:*`,
      `👉 ${res.url}`
    ].join("\n");

    // Kirim avatar foto profil jika tersedia
    if (res.avatarUrl && /^https?:\/\//i.test(res.avatarUrl)) {
      try {
        const jid = context.remoteJid;
        return await sock.sendMessage(
          jid,
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
