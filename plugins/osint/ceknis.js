import { getSiswaInfoText, getMultiSiswaInfoText, parseMultiNis } from "@/src/services/ceknis.js";

export default {
  "name": "ceknis",
  "aliases": ["siswa", "datanis", "ceknisnis", "carinis"],
  "description": "Cek data siswa berdasarkan NIS via Google Apps Script (mode=nis)",
  "usage": "<nis, cth: 539241249>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, senderJid, isOwner, isAdmin, logger }) => {
      const currentPrefix = prefix || ".";
      const input = (args || []).join(" ").trim();

      if (!input) {
        return reply(
          `Masukkan NIS! Contoh: \`${currentPrefix}ceknis 539241249\`\n` +
          `Multi (maks 5): \`${currentPrefix}ceknis 539241249, 539241250\``
        );
      }

      sendTyping();

      try {
        const showFullPhone = true;
        const { valid, invalid } = parseMultiNis(input, 5);

        if (valid.length === 0) {
          return reply(
            `Format NIS salah${invalid.length ? `: ${invalid.slice(0, 3).join(", ")}` : ""}.\n\n` +
            `Gunakan: \`${currentPrefix}ceknis <nis>\`\n` +
            `Contoh: \`${currentPrefix}ceknis 539241249\``
          );
        }

        if (valid.length === 1) {
          const result = await getSiswaInfoText(valid[0], "nis", { showFullPhone, logger });
          if (result.error) {
            return reply(
              `${result.error}\n\n` +
              `Gunakan: \`${currentPrefix}ceknis <nis>\`\n` +
              `Contoh: \`${currentPrefix}ceknis 539241249\``
            );
          }
          return reply(result.text);
        }

        const results = await getMultiSiswaInfoText(valid, { showFullPhone, logger });
        const blocks = results.map((r) => (r.text ? r.text : `*DATA SISWA*\nNIS: ${r.nis}\nError: ${r.error}`));
        let text = blocks.join("\n\n");
        if (invalid.length > 0) {
          text += `\n\n_Diabaikan (bukan NIS): ${invalid.slice(0, 5).join(", ")}_`;
        }
        return reply(text);
      } catch (err) {
        logger?.warn?.(`[ceknis] gagal: ${err.message}`);
        return reply(`Gagal memproses: ${err.message}`);
      }
    },
};
