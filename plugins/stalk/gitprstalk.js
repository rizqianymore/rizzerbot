import { lookupGitPr } from "@/src/services/osint/gitprstalk.js";

export default {
  name: "gitprstalk",
  aliases: ["gitpr", "stalkpr", "ghpr", "pullrequeststalk"],
  description: "Intelijen OSINT kontribusi Pull Request (PR) pengembang di GitHub",
  usage: "<username github>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT GITHUB PULL REQUEST STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitprstalk <username-github>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitprstalk torvalds\n` +
        `• ${context.prefix || "."}gitprstalk sindresorhus`
      );
    }

    await context.sendTyping();

    const res = await lookupGitPr(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN PULL REQUEST (KONTRIBUSI KODE)*`,
      `Pengembang    : *${res.username}*`,
      `Total PR Dibuat: *${res.totalCount.toLocaleString("id-ID")} Pull Request*\n`,
      `*Riwayat PR Publik Terakhir:*`,
    ];

    for (const pr of res.prs) {
      const icon = pr.state === "open" ? "🟢 [OPEN]" : "🟣 [MERGED/CLOSED]";
      out.push(
        `${icon} *${pr.title}*`,
        `  • Tanggal: 📅 ${pr.createdDate}`,
        `  • Link   : 🔗 ${pr.url}`,
        ``
      );
    }

    return context.reply(out.join("\n"));
  },
};
