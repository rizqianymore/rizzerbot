import { lookupGitRepo } from "@/src/services/osint/gitrepostalk.js";

export default {
  name: "gitrepostalk",
  aliases: ["gitrepo", "repostalk", "ghrepo", "stalkrepo"],
  description: "Intelijen OSINT repositori GitHub (Jumlah bintang, fork, lisensi, issues, branch default)",
  usage: "<owner/repo atau link>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
      if (match) input = match[1];
    }

    if (!input) {
      return context.reply(
        `*OSINT GITHUB REPOSITORY STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitrepostalk <owner/repository>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitrepostalk torvalds/linux\n` +
        `• ${context.prefix || "."}gitrepostalk expressjs/express\n` +
        `• ${context.prefix || "."}gitrepostalk https://github.com/facebook/react`
      );
    }

    await context.sendTyping();

    const res = await lookupGitRepo(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN GITHUB REPOSITORY*`,
      `Repositori    : *${res.fullName}*`,
      `Pemilik/Org   : ${res.owner}`,
      `Bahasa Utama  : 💻 ${res.language}`,
      `Bintang (Stars): ⭐ ${res.stars.toLocaleString("id-ID")}`,
      `Forks         : 🍴 ${res.forks.toLocaleString("id-ID")}`,
      `Open Issues   : ⚠️ ${res.openIssues.toLocaleString("id-ID")}`,
      `Lisensi       : 📜 ${res.license}`,
      `Dibuat Tanggal: 📅 ${res.createdDate}`,
      `Update Terkini: 🔄 ${res.updatedDate}`,
      ``,
      `*Deskripsi Project:*`,
      `${res.description}`,
      ``,
      `*Link Repositori:*`,
      `👉 ${res.repoUrl}`
    ].join("\n");

    if (res.ownerAvatar && /^https?:\/\//i.test(res.ownerAvatar)) {
      try {
        return await sock.sendMessage(
          context.remoteJid,
          {
            image: { url: res.ownerAvatar },
            caption,
          },
          { quoted: msg }
        );
      } catch (_) {}
    }

    return context.reply(caption);
  },
};
