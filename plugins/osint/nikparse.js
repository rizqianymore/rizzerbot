// plugins/tools/nikparse.js — perintah "nikparse" (1 file = 1 perintah).
import { parseNik, getNikInfoText } from "@/src/services/nikparse.js";

export default {
  "name": "nikparse",
  "aliases": ["nik", "ceknik", "parsenik"],
  "description": "Parse NIK KTP: jk, tgl lahir, umur, zodiak, wilayah",
  "usage": "<nik16>",
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const currentPrefix = prefix || ".";
      const nik = (args[0] || "").trim();

      const parsed = parseNik(nik);
      if (!parsed.valid) {
        return reply(
          `NIK tidak valid: ${parsed.reason || "format salah"}\n\n` +
          `Gunakan: \`${currentPrefix}nikparse <nik16>\`\n` +
          `Contoh: \`${currentPrefix}nikparse 1371117105550001\``
        );
      }

      await sendTyping();
      try {
        return reply(await getNikInfoText(nik));
      } catch (err) {
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
