import { request } from "@/src/utils/request.js";

async function searchKodePos(query) {
  const clean = query.trim();
  const endpoints = [
    `https://kodepos.vercel.app/search?q=${encodeURIComponent(clean)}`,
    `https://api-kodepos.vercel.app/search?q=${encodeURIComponent(clean)}`,
  ];

  let lastErr = null;
  for (const url of endpoints) {
    try {
      const json = await request.json(url, { timeout: 8000 });
      if (Array.isArray(json?.data)) {
        return json.data;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Gagal mengambil data dari server kode pos");
}

export default {
  name: "cekkodepos",
  aliases: ["kodepos", "poscode", "carikodepos", "kodeposwilayah"],
  description: "Cari data kode pos, kelurahan, kecamatan, dan kota/kabupaten di Indonesia",
  usage: "<nama kelurahan / kecamatan / kota / 5 digit kode>",
  category: "OSINT",
  premiumOnly: true,
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `*PENCARIAN KODE POS INDONESIA*\n\n` +
          `Masukkan nama daerah (kelurahan, kecamatan, kota) atau 5 digit kode pos.\n\n` +
          `*Contoh:*\n` +
          `│ \`${currentPrefix}cekkodepos Kemanggisan\`\n` +
          `│ \`${currentPrefix}kodepos Palmerah\`\n` +
          `│ \`${currentPrefix}cekkodepos 11480\``
      );
    }

    if (input.length < 3) {
      return reply("Kata kunci pencarian terlalu pendek (minimal 3 karakter).");
    }

    await sendTyping();
    await reply(`Mencari data kode pos untuk *${input}*...`);

    try {
      const list = await searchKodePos(input);

      if (!list || list.length === 0) {
        return reply(`Data wilayah/kode pos untuk *"${input}"* tidak ditemukan.`);
      }

      const total = list.length;
      const displayed = list.slice(0, 15);

      let text = `*OSINT TOOLS - KODE POS INDONESIA*
`;
      text += `├── Kueri        : ${input}
`;
      text += `├── Ditemukan    : ${results.length} Wilayah
`;
      text += `│
`;
      results.slice(0, 5).forEach((item, idx) => {
        text += `├── [${idx + 1}] Kode Pos : \`${item.postalcode || item.kodepos || "-"}\`
`;
        text += `│   Wilayah  : ${item.urban || item.kelurahan || "-"}, ${item.subdistrict || item.kecamatan || "-"}
`;
        text += `│   Kota/Kab : ${item.city || item.kabupaten || "-"}
`;
        text += `│   Provinsi : ${item.province || item.provinsi || "-"}
`;
        if (idx < Math.min(results.length, 5) - 1) text += `│
`;
      });
      text += `│
`;
      text += `└─ [STATUS: KODE POS FOUND]`;
      return reply(text);
    } catch (err) {
      return reply(`Terjadi kesalahan saat mencari kode pos: ${err.message}`);
    }
  },
};
