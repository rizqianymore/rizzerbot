import { getSekolahInfoText } from "@/src/services/osint/dapodik.js";

export default {
  name: "ceksekolah",
  aliases: ["sekolah", "ceknpsn", "npsn", "dapodik", "cekdatasekolah"],
  description: "Cek data sekolah (SD/SMP/SMA/SMK) via Dapodik Kemendikdasmen",
  usage: "<nama sekolah / NPSN 8 digit>",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim();

    if (!input) {
      return reply(
        `*CEK SEKOLAH — DAPODIK*\n\n` +
          `Masukkan nama sekolah atau NPSN (8 digit).\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}ceksekolah SMAN 1 Jakarta\`\n` +
          `• \`${currentPrefix}sekolah SDN Menteng 01\`\n` +
          `• \`${currentPrefix}npsn 20100216\`\n\n` +
          `_Sumber: dapo.kemendikdasmen.go.id (akreditasi, alamat, jumlah siswa & guru)_`
      );
    }

    await sendTyping();
    try {
      const result = await getSekolahInfoText(input);
      if (result.error) {
        return reply(
          `${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}ceksekolah <nama / NPSN>\`\n` +
            `Contoh: \`${currentPrefix}ceksekolah SMAN 3 Bandung\``
        );
      }
      return reply(result.text);
    } catch (err) {
      logger?.warn?.(`[ceksekolah] gagal: ${err.message}`);
      return reply(`Gagal memproses: ${err.message}`);
    }
  },
};
