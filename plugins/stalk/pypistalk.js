import { lookupPypi } from "@/src/services/osint/pypistalk.js";

export default {
  name: "pypistalk",
  aliases: ["pypi", "pythonpkg", "stalkpypi", "pipstalk"],
  description: "Intelijen OSINT paket Python di PyPI (Versi rilis, pembuat/author, lisensi, dokumentasi)",
  usage: "<nama paket python>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT PYPI PACKAGE STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}pypistalk <nama-paket-python>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}pypistalk requests\n` +
        `• ${context.prefix || "."}pypistalk fastapi\n` +
        `• ${context.prefix || "."}pypistalk numpy`
      );
    }

    await context.sendTyping();

    const res = await lookupPypi(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN PAKET PYPI (PYTHON)*`,
      `Nama Paket   : 🐍 *${res.name}* (v${res.version})`,
      `Pembuat      : ${res.author}`,
      `Lisensi      : 📜 ${res.license}`,
      `Versi Python : ${res.requiresPython}`,
      ``,
      `*Ringkasan Paket:*`,
      `${res.summary}`,
      ``,
      `*Tautan:*`,
      `• PyPI Page  : 🔗 ${res.packageUrl}`,
      `• Homepage   : 🔗 ${res.homePage}`
    ];

    return context.reply(out.join("\n"));
  },
};
