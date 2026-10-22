import { searchGtk } from "@/src/services/osint/simpkb.js";

export default {
  name: "cekgtk",
  aliases: ["gtk", "simpkb", "cekguru", "guru", "ukg", "nuptk"],
  description: "Cek data GTK / Guru SIMPKB (Nama, No. UKG, NUPTK, NIK)",
  usage: "<nama / no ukg / nuptk / nik>",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim();

    if (!input) {
      return reply(
        `*CEK GTK / GURU — SIMPKB*\n\n` +
          `Masukkan Nama GTK, No. UKG (SIMPKB-ID), NUPTK, atau NIK.\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}cekgtk ROSYANTO\`\n` +
          `• \`${currentPrefix}cekgtk 201698552239\`\n` +
          `• \`${currentPrefix}cekgtk 0245761662130153\`\n\n` +
          `_Sumber: portal-backend.simpkb.id (Realtime Portal SIMPKB)_`
      );
    }

    await sendTyping();
    try {
      const result = await searchGtk(input);
      if (result.error) {
        return reply(
          `${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}cekgtk <nama/ukg/nuptk/nik>\`\n` +
            `Contoh: \`${currentPrefix}cekgtk ROSYANTO\``
        );
      }
      return reply(result.text);
    } catch (err) {
      logger?.warn?.(`[cekgtk] gagal: ${err.message}`);
      return reply(`Gagal memproses pencarian GTK: ${err.message}`);
    }
  },
};
