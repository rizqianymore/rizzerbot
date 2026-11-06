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
        `*OSINT NPM MAINTAINER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}npmstalk <username-npm>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}npmstalk sindresorhus\n` +
        `• ${context.prefix || "."}npmstalk isaacs`
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
      `*HASIL INTELIJEN DEVELOPER NPM*`,
      `Maintainer    : *${res.username}*`,
      `Total Package : *${res.totalPackages.toLocaleString("id-ID")} Paket Terbit*`,
      ``,
      `*Paket Teratas / Populer:*`,
    ];

    for (const pkg of res.packages) {
      out.push(
        `📦 *${pkg.name}* (v${pkg.version})`,
        `  • Unduhan/Bulan: ${pkg.monthlyDownloads.toLocaleString("id-ID")}`,
        `  • Deskripsi    : ${pkg.description.slice(0, 80)}...`,
        `  • Link         : ${pkg.npmUrl}`,
        ``
      );
    }

    out.push(`*Link Profil NPM:*`, `👉 ${res.profileUrl}`);
    return context.reply(out.join("\n"));
  },
};
