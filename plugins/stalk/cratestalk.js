import { lookupCrates } from "@/src/services/osint/cratestalk.js";

export default {
  name: "cratestalk",
  aliases: ["crates", "stalkcrates", "rustcrate", "rustpkg"],
  description: "Intelijen OSINT paket/crate bahasa pemrograman Rust (Unduhan total, versi terbaru, repo, docs.rs)",
  usage: "<nama crate rust>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT RUST CRATES STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}cratestalk <nama-crate>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}cratestalk tokio\n` +
        `• ${context.prefix || "."}cratestalk serde\n` +
        `• ${context.prefix || "."}cratestalk reqwest`
      );
    }

    await context.sendTyping();

    const res = await lookupCrates(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN CRATE RUST (CRATES.IO)*`,
      `Nama Crate   : 🦀 *${res.name}* (v${res.version})`,
      `Total Unduhan: 📥 *${res.downloads.toLocaleString("id-ID")} kali*`,
      `Unduhan Baru : 📈 ${res.recentDownloads.toLocaleString("id-ID")} (recent)`,
      `Dibuat Sejak : 📅 ${res.createdDate}`,
      res.repository !== "-" ? `Repository   : 🔗 ${res.repository}` : "",
      ``,
      `*Deskripsi Crate:*`,
      `${res.description}`,
      ``,
      `*Dokumentasi Resmi:*`,
      `• Docs.rs    : 📚 ${res.documentation}`,
      `• Crates.io  : 🔗 ${res.crateUrl}`
    ].filter(Boolean);

    return context.reply(out.join("\n"));
  },
};
