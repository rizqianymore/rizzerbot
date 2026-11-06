import { lookupGitRelease } from "@/src/services/osint/gitreleasestalk.js";

export default {
  name: "gitreleasestalk",
  aliases: ["gitrelease", "ghrelease", "releasestalk", "softwarerelease"],
  description: "Intelijen OSINT versi & file binary rilis software di GitHub (Tag versi, file download, changelog)",
  usage: "<owner/repo>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
      if (match) input = match[1];
    }

    if (!input) {
      return context.reply(
        `*OSINT GITHUB SOFTWARE RELEASE STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}gitreleasestalk <owner/repository>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}gitreleasestalk facebook/react\n` +
        `• ${context.prefix || "."}gitreleasestalk oven-sh/bun\n` +
        `• ${context.prefix || "."}gitreleasestalk protocolbuffers/protobuf`
      );
    }

    await context.sendTyping();

    const res = await lookupGitRelease(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN RILIS SOFTWARE GITHUB*`,
      `Repositori    : *${res.repo}*`,
      `Tag Versi     : 🏷️ *${res.tagName}* (${res.releaseName})`,
      `Publisher     : 👤 ${res.author}`,
      `Tanggal Rilis : 📅 ${res.publishedDate}`,
      ``,
      `*Changelog / Catatan Rilis:*`,
      `${res.body}`,
      ``,
    ];

    if (res.assets.length > 0) {
      out.push(`*File Installer / Binary Terlampir:*`);
      for (const a of res.assets.slice(0, 3)) {
        out.push(`• 📦 \`${a.name}\` (${a.sizeMb} MB) — 📥 ${a.downloads.toLocaleString("id-ID")} downloads`);
      }
      out.push(``);
    }

    out.push(`*Halaman Rilis Resmi:*`, `👉 ${res.htmlUrl}`);
    return context.reply(out.join("\n"));
  },
};
