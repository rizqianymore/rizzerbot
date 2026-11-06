import { lookupGitlab } from "@/src/services/osint/gitlabstalk.js";

export default {
  name: "gitlabstalk",
  aliases: ["gitlab", "stalkgitlab", "glstalk", "gitlabuser"],
  description: "Intelijen OSINT developer & pengguna GitLab (User ID, status akun, foto profil HD)",
  usage: "<username gitlab>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT GITLAB USER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitlabstalk <username-gitlab>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitlabstalk gitlab\n` +
        `• ${context.prefix || "."}gitlabstalk sytses`
      );
    }

    await context.sendTyping();

    const res = await lookupGitlab(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN GITLAB DEVELOPER*`,
      `Username   : *${res.username}*`,
      `Nama       : ${res.name}`,
      `User ID    : \`${res.userId}\``,
      `Status Akun: ${res.state === "active" ? "✅ Aktif" : "⚠️ " + res.state}`,
      `Locked     : ${res.isLocked ? "🔒 Terkunci" : "🔓 Normal"}`,
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
