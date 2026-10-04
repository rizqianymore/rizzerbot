// plugins/tools/cekdosen.js — perintah "cekdosen" (1 file = 1 perintah).
import { getCekdosenInfoText } from "@/src/services/pddikti.js";

export default {
  "name": "cekdosen",
  "aliases": ["cekdosenpddikti", "carinidn", "dosen"],
  "description": "Cek data dosen via PDDikti (nama / NIDN + detail)",
  "usage": "<nama atau NIDN, cth: 2013119103>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
      const currentPrefix = prefix || ".";
      const input = (args || []).join(" ").trim();

      if (!input) {
        return reply(
          `Masukkan nama atau NIDN! Contoh: \`${currentPrefix}cekdosen 2013119103\`\n` +
          `Cari nama: \`${currentPrefix}cekdosen PUSPA NOVITA SARI\``
        );
      }

      await sendTyping();
      try {
        const result = await getCekdosenInfoText(input, { logger });
        if (result.error) {
          return reply(
            `${result.error}\n\n` +
            `Gunakan: \`${currentPrefix}cekdosen <nama/nidn>\`\n` +
            `Contoh: \`${currentPrefix}cekdosen 2013119103\``
          );
        }
        return reply(result.text);
      } catch (err) {
        logger?.warn?.(`[cekdosen] gagal: ${err.message}`);
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
