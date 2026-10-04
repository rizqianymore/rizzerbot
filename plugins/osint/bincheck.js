// plugins/tools/bincheck.js — perintah "bincheck" (1 file = 1 perintah).
import { parseBin, enrichBin, formatBinInfo } from "@/src/services/bincheck.js";

export default {
  "name": "bincheck",
  "aliases": ["bin", "cekbin", "binlookup"],
  "description": "Cek BIN kartu (6-8 digit pertama): skema, tipe, bank, negara",
  "usage": "<6-8 digit awal kartu, cth: 45717360>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const currentPrefix = prefix || ".";
      const input = (args || []).join(" ").trim();

      if (!input) {
        return reply(
          `Masukkan 6-8 digit pertama kartu! Contoh: \`${currentPrefix}bincheck 45717360\`\n` +
          `Jangan kirim nomor kartu lengkap — cukup 6-8 digit pertama.`
        );
      }

      const parsed = parseBin(input);
      if (!parsed.valid) {
        return reply(
          `BIN tidak valid: ${parsed.reason || "format salah"}\n\n` +
          `Gunakan: \`${currentPrefix}bincheck <6-8 digit>\`\n` +
          `Contoh: \`${currentPrefix}bincheck 45717360\``
        );
      }

      await sendTyping();
      try {
        await enrichBin(parsed);
        return reply(formatBinInfo(parsed));
      } catch (err) {
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
