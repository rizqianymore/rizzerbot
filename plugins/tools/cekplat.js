// plugins/tools/cekplat.js — perintah "cekplat" (1 file = 1 perintah).
import { parsePlat, enrichSamsat, formatPlatInfo } from "@/src/services/cekplat.js";

export default {
  "name": "cekplat",
  "aliases": ["plat", "ceknopol", "nopol"],
  "description": "Parse plat nomor Indonesia: wilayah, provinsi, perkiraan jenis kendaraan",
  "usage": "<plat, cth: B 1234 ABC>",
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const currentPrefix = prefix || ".";
      const input = (args || []).join(" ").trim();

      if (!input) {
        return reply(
          `Masukkan plat nomor! Contoh: \`${currentPrefix}cekplat B 1234 ABC\`\n` +
          `Contoh lain: \`${currentPrefix}cekplat AD 1234 AB\`, \`${currentPrefix}cekplat BK 5678 AA\`, \`${currentPrefix}cekplat CD 12 34\``
        );
      }

      const parsed = parsePlat(input);
      if (!parsed.valid) {
        return reply(
          `Plat tidak valid: ${parsed.reason || "format salah"}\n\n` +
          `Gunakan: \`${currentPrefix}cekplat <plat>\`\n` +
          `Contoh: \`${currentPrefix}cekplat B 1234 ABC\``
        );
      }

      await sendTyping();
      try {
        const parsed = parsePlat(input);
        // Enrich presisi (Daerah + Samsat + Alamat) via Firestore samsat.info.
        // Gagal network = fallback offline, tidak throw ke user.
        await enrichSamsat(parsed);
        return reply(formatPlatInfo(parsed));
      } catch (err) {
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
