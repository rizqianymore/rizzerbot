import { lookupGitIssue } from "@/src/services/osint/gitissuestalk.js";

export default {
  name: "gitissuestalk",
  aliases: ["gitissue", "stalkissue", "ghissue", "issuestalk"],
  description: "Intelijen OSINT isu, bug, & diskusi teknis yang dibuat pengembang di GitHub",
  usage: "<username github>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT GITHUB ISSUES STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitissuestalk <username-github>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitissuestalk torvalds\n` +
        `• ${context.prefix || "."}gitissuestalk antirez`
      );
    }

    await context.sendTyping();

    const res = await lookupGitIssue(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN GITHUB ISSUES (LAPORAN MASALAH)*`,
      `Pengembang      : *${res.username}*`,
      `Total Issue Dibuat: *${res.totalCount.toLocaleString("id-ID")} Laporan*\n`,
      `*Riwayat Issue Publik Terkini:*`,
    ];

    for (const is of res.issues) {
      const icon = is.state === "open" ? "🟢 [OPEN]" : "🟣 [CLOSED]";
      out.push(
        `${icon} *${is.title}* (💬 ${is.comments} balasan)`,
        `  • Tanggal: 📅 ${is.createdDate}`,
        `  • Link   : 🔗 ${is.url}`,
        ``
      );
    }

    return context.reply(out.join("\n"));
  },
};
