import { getKampusInfoText } from "@/src/services/osint/pddikti.js";

export default {
  name: "cekkampus",
  aliases: ["kampus", "cekpt", "perguruaninggi", "pt", "cekkpt"],
  description: "Cek data perguruan tinggi via PDDikti (profil, akreditasi, prodi, rasio)",
  usage: "<nama kampus / kode PT, cth: Institut Teknologi Bandung>",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim();

    if (!input) {
      return reply(
        `🎓 *CEK PERGURUAN TINGGI — PDDIKTI*\n\n` +
          `Masukkan nama perguruan tinggi atau kode PT.\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}cekkampus Institut Teknologi Bandung\`\n` +
          `• \`${currentPrefix}kampus UGM\`\n` +
          `• \`${currentPrefix}cekpt 002001\`\n\n` +
          `_Sumber: PDDikti (profil PT, akreditasi, prodi, rasio dosen:mahasiswa)_`
      );
    }

    await sendTyping();
    try {
      const result = await getKampusInfoText(input);
      if (result.error) {
        return reply(
          `❌ ${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}cekkampus <nama / kode PT>\`\n` +
            `Contoh: \`${currentPrefix}cekkampus Universitas Indonesia\``
        );
      }
      return reply(result.text);
    } catch (err) {
      logger?.warn?.(`[cekkampus] gagal: ${err.message}`);
      return reply(`Gagal memproses: ${err.message}`);
    }
  },
};
