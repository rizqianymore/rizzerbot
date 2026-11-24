import { fetchPejabatDpr, formatDprMember } from "@/src/services/osint/pejabat.js";

export default {
  name: "cekdpr",
  aliases: ["pejabat", "cekpejabat", "anggotadpr", "dprri", "dpr"],
  description: "Cek profil, fraksi, komisi, dan dapil anggota DPR RI (Scraping pejabat.id/dpr)",
  usage: "<nama anggota / fraksi / dapil>",
  category: "OSINT",
  ownerOnly: true,
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const p = prefix || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return reply(
        `*CEK ANGGOTA DPR RI & PEJABAT*\n\n` +
          `Gunakan format:\n` +
          `│ \`${p}cekdpr <nama anggota / fraksi / dapil>\`\n` +
          `│ \`${p}pejabat <nama pejabat>\`\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}cekdpr Puan Maharani\`\n` +
          `│ \`${p}cekdpr Gerindra\`\n` +
          `│ \`${p}cekdpr Jawa Barat I\`\n\n` +
          `Data bersumber dari direktori publik pejabat parlemen https://pejabat.id/dpr.`
      );
    }

    await sendTyping();

    try {
      const results = await fetchPejabatDpr(query, { logger });

      if (!results || results.length === 0) {
        return reply(
          `*OSINT DPR RI*\n\n` + `Data anggota DPR dengan kata kunci "*${query}*" tidak ditemukan di pejabat.id/dpr.`
        );
      }

      if (results.length === 1) {
        const text = formatDprMember(results[0]);
        return reply(text);
      }

      let text = `*HASIL PENCARIAN DPR RI (${results.length} Ditemukan)*\n\n`;
      const displayed = results.slice(0, 10);

      displayed.forEach((item, idx) => {
        text += `*${idx + 1}. ${item.nama}*\n`;
        text += `   │ Fraksi : ${item.fraksi || "-"}\n`;
        text += `   │ Dapil  : ${item.dapil || "-"}\n`;
        text += `   │ Komisi : ${item.komisi || "-"}\n\n`;
      });

      if (results.length > 10) {
        text += `_Menampilkan 10 dari ${results.length} hasil. Persempit pencarian dengan nama lebih lengkap._`;
      }

      return reply(text.trim());
    } catch (err) {
      logger?.warn?.(`[cekdpr] ${err.message}`);
      return reply(
        `*GAGAL CEK PEJABAT / DPR*\n\n` +
          `Error: ${err.message}\n\n` +
          `Catatan: Platform target (pejabat.id) menerapkan proteksi keamanan Cloudflare Managed Challenge.`
      );
    }
  },
};
