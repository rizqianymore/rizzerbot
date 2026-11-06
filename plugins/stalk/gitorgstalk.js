import { lookupGitOrg } from "@/src/services/osint/gitorgstalk.js";

export default {
  name: "gitorgstalk",
  aliases: ["gitorg", "stalkorg", "ghorg", "githuborg"],
  description: "Intelijen OSINT organisasi/perusahaan GitHub (Total repositori, website, followers, status verified)",
  usage: "<nama organisasi>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT GITHUB ORGANIZATION STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitorgstalk <nama-organisasi>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitorgstalk google\n` +
        `• ${context.prefix || "."}gitorgstalk nodejs\n` +
        `• ${context.prefix || "."}gitorgstalk microsoft`
      );
    }

    await context.sendTyping();

    const res = await lookupGitOrg(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN GITHUB ORGANIZATION*`,
      `Organisasi    : *${res.name}* (@${res.login}) ${res.isVerified ? "✔ (Verified)" : ""}`,
      `Total Repos   : *${res.publicRepos.toLocaleString("id-ID")} Repositori Publik*`,
      `Followers     : 👥 ${res.followers.toLocaleString("id-ID")}`,
      `Dibuat Tanggal: 📅 ${res.createdDate}`,
      res.blog !== "-" ? `Website Resmi : 🌐 ${res.blog}` : "",
      res.email !== "-" ? `Email Kontak  : 📧 ${res.email}` : "",
      ``,
      `*Deskripsi:*`,
      `${res.description}`,
      ``,
      `*Link Organisasi:*`,
      `👉 ${res.orgUrl}`
    ].filter(Boolean).join("\n");

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
