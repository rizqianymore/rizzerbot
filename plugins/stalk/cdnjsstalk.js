import { lookupCdnjs } from "@/src/services/osint/cdnjsstalk.js";

export default {
  name: "cdnjsstalk",
  aliases: ["cdnjs", "stalkcdnjs", "cdnlibrary", "cdnjspkg"],
  description: "Intelijen OSINT pustaka web CDNJS Cloudflare (Link CDN, versi terbaru, lisensi, repo sumber)",
  usage: "<nama library cdnjs>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT CDNJS LIBRARY STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}cdnjsstalk <nama-library>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}cdnjsstalk jquery\n` +
        `• ${context.prefix || "."}cdnjsstalk bootstrap\n` +
        `• ${context.prefix || "."}cdnjsstalk sweetalert2`
      );
    }

    await context.sendTyping();

    const res = await lookupCdnjs(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN LIBRARY CDNJS*`,
      `Library      : 🌐 *${res.name}* (v${res.version})`,
      `Lisensi      : 📜 ${res.license}`,
      res.repository !== "-" ? `Repository   : 🔗 ${res.repository}` : "",
      ``,
      `*Deskripsi:*`,
      `${res.description}`,
      ``,
      `*Link CDN Resmi:*`,
      `👉 \`${res.latestCdnUrl}\``,
      ``,
      `*Homepage:*`,
      `🔗 ${res.homepage}`
    ].filter(Boolean);

    return context.reply(out.join("\n"));
  },
};
