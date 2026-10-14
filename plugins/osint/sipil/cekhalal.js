import { searchHalal, formatResults } from "@/src/services/osint/halal.js";

const KEYS = {
  produk: "produk",
  produk_: "produk",
  "nama produk": "produk",
  pelaku: "pelaku",
  "pelaku usaha": "pelaku",
  usaha: "pelaku",
  sertifikat: "sertifikat",
  "no sertifikat": "sertifikat",
  nomor: "sertifikat",
};

export default {
  name: "cekhalal",
  aliases: ["halal", "ceksertifikathalal", "cekhalalproduk"],
  description: "Cek sertifikat halal produk di bpjph.halal.go.id (BPJPH Kemenag)",
  usage: "<nama produk|pelaku usaha|no sertifikat>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const rawArgs = (args || []).join(" ").trim();

    if (!rawArgs) {
      return reply(
        `*CEK PRODUK HALAL — BPJPH*\n\n` +
          `Cek apakah produk sudah bersertifikat halal resmi dari BPJPH Kemenag.\n\n` +
          `*Format:*\n` +
          `\`${currentPrefix}cekhalal <nama produk>\`\n` +
          `\`${currentPrefix}cekhalal pelaku <nama usaha>\`\n` +
          `\`${currentPrefix}cekhalal no <no sertifikat>\`\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}cekhalal Indomie\`\n` +
          `• \`${currentPrefix}cekhalal "Manggo Sticky Rice"\`\n` +
          `• \`${currentPrefix}halal pelaku "PT ABC"\`\n` +
          `• \`${currentPrefix}cekhalal no ID32110078776040726\`\n\n` +
          `_Sumber: bpjph.halal.go.id (BPJPH Kemenag RI)_`
      );
    }

    await sendTyping();
    const startTime = Date.now();

    try {
      const parts = rawArgs.split(/\s+/);
      const first = parts[0].toLowerCase();
      let key = "produk";
      let query = rawArgs;

      if (KEYS[first] && parts.length > 1) {
        key = KEYS[first];
        query = parts.slice(1).join(" ");
      }

      if (query.trim().length < 2) {
        return reply("Query terlalu pendek (minimal 2 karakter).");
      }

      const result = await searchHalal(query, { key, page: 1 });
      return reply(formatResults(query, result, startTime));
    } catch (err) {
      return reply(`Gagal memeriksa: ${err.message}`);
    }
  },
};
