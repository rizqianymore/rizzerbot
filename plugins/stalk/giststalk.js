import { lookupGitGists } from "@/src/services/osint/giststalk.js";

export default {
  name: "giststalk",
  aliases: ["gist", "stalkgist", "ghgist", "githubgist"],
  description: "Intelijen OSINT cuplikan kode (Gist) publik pengembang GitHub",
  usage: "<username github>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT GITHUB GIST STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}giststalk <username-github>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}giststalk torvalds\n` +
        `• ${context.prefix || "."}giststalk sindresorhus`
      );
    }

    await context.sendTyping();

    const res = await lookupGitGists(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN GITHUB GISTS*`,
      `Pengembang    : *${res.username}*`,
      `Daftar Cuplikan Kode Terkini:\n`,
    ];

    for (const g of res.gists) {
      out.push(
        `📄 *${g.filename}* (💬 ${g.comments} komentar)`,
        `  • Deskripsi: ${g.description}`,
        `  • Dibuat   : ${g.createdDate}`,
        `  • Link     : 🔗 ${g.url}`,
        ``
      );
    }

    out.push(`*Koleksi Gist Lengkap:*`, `👉 ${res.profileUrl}`);
    return context.reply(out.join("\n"));
  },
};
