import { getCeknimInfoText } from "@/src/services/osint/pddikti.js";

export default {
  name: "ceknim",
  aliases: ["cekmahasiswa", "cekstudent", "pddikti", "carinim", "mhs"],
  description: "Cek data mahasiswa via PDDikti (nama / NIM + detail)",
  usage: "<nama atau NIM, cth: 201311413>",
  premiumOnly: true,
  cooldownMs: 8000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim();

    if (!input || input.length < 2) {
      return reply(
        `*CEK MAHASISWA — PDDIKTI*\n\n` +
          `Masukkan nama mahasiswa atau NIM (minimal 2 karakter).\n\n` +
          `*Contoh:*\n` +
          `│ \`${currentPrefix}ceknim 201311413\`\n` +
          `│ \`${currentPrefix}ceknim Raka Pratama\``
      );
    }

    await sendTyping();
    try {
      const result = await getCeknimInfoText(input, { logger });
      if (result.error) {
        return reply(
          `${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}ceknim <nama/nim>\`\n` +
            `Contoh: \`${currentPrefix}ceknim 201311413\``
        );
      }
      return reply(result.text);
    } catch (err) {
      logger?.warn?.(`[ceknim] gagal: ${err.message}`);
      return reply(`Gagal memproses: ${err.message}`);
    }
  },
};
