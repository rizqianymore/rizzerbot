import { lookupNpm } from "@/src/services/osint/npmstalk.js";

export default {
  name: "npmstalk",
  aliases: ["npm", "stalknpm", "npmuser", "npmpackage"],
  description: "Intelijen OSINT developer NPM Registry (Jumlah package, paket terpopuler, download bulanan)",
  usage: "<username npm>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `┌── OSINT NPM MAINTAINER\n` +
        `│ Format: ${context.prefix || "."}npmstalk <username>\n` +
        `└──\n\n` +
        `Contoh: ${context.prefix || "."}npmstalk sindresorhus`
      );
    }

    await context.sendTyping();

    const res = await lookupNpm(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `┌── NPM DEVELOPER: ${res.username}`,
      `│ Total Package: ${res.totalPackages.toLocaleString("id-ID")}`,
      `└──\n`,
      `┌── PAKET TERATAS`,
    ];

    for (const pkg of res.packages.slice(0, 5)) {
      out.push(
        `│ • ${pkg.name} (v${pkg.version}) — ${pkg.monthlyDownloads.toLocaleString("id-ID")} dl/bln`
      );
    }
    out.push(`└──`);

    out.push(`*Link Profil NPM:*`, `👉 ${res.profileUrl}`);
    return context.reply(out.join("\n"));
  },
};
