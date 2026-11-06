import { lookupWiki } from "@/src/services/osint/wikistalk.js";

export default {
  name: "wikistalk",
  aliases: ["tokohstalk", "stalktokoh", "stalkwiki", "biografi"],
  description: "Intelijen OSINT biografi tokoh, publik figur, artis, atau entitas di Wikipedia (Foto & riwayat profil)",
  usage: "<nama tokoh/figur>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args.join(" ").trim();
    if (!input) {
      return context.reply(
        `*OSINT TOKOH & BIOGRAFI STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}wikistalk <nama-tokoh/figur>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}wikistalk Joko Widodo\n` +
        `• ${context.prefix || "."}wikistalk Elon Musk\n` +
        `• ${context.prefix || "."}wikistalk Raden Saleh`
      );
    }

    await context.sendTyping();

    const res = await lookupWiki(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN BIOGRAFI TOKOH*`,
      `Nama Entitas : *${res.title}*`,
      ``,
      `*Ringkasan Profil:*`,
      `${res.extract}`,
      ``,
      `*Artikel Lengkap:*`,
      `👉 ${res.wikiUrl}`
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
