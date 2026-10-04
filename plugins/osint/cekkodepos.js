async function searchKodePos(query) {
  const clean = query.trim();
  const endpoints = [
    `https://kodepos.vercel.app/search?q=${encodeURIComponent(clean)}`,
    `https://api-kodepos.vercel.app/search?q=${encodeURIComponent(clean)}`,
  ];

  let lastErr = null;
  for (const url of endpoints) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: ctrl.signal,
      });

      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        return json.data;
      }
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
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
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `📮 *PENCARIAN KODE POS INDONESIA*\n\n` +
        `Masukkan nama daerah (kelurahan, kecamatan, kota) atau 5 digit kode pos.\n\n` +
        `*Contoh:*\n` +
        `• \`${currentPrefix}cekkodepos Kemanggisan\`\n` +
        `• \`${currentPrefix}kodepos Palmerah\`\n` +
        `• \`${currentPrefix}cekkodepos 11480\``
      );
    }

    if (input.length < 3) {
      return reply("❌ Kata kunci pencarian terlalu pendek (minimal 3 karakter).");
    }

    await sendTyping();
    await reply(`🔍 Mencari data kode pos untuk *${input}*...`);

    try {
      const list = await searchKodePos(input);

      if (!list || list.length === 0) {
        return reply(`❌ Data wilayah/kode pos untuk *"${input}"* tidak ditemukan.`);
      }

      const total = list.length;
      const displayed = list.slice(0, 15);

      const lines = [
        `📮 *HASIL PENCARIAN KODE POS*`,
        `Kata kunci: \`${input}\``,
        `Ditemukan: *${total}* wilayah (menampilkan ${displayed.length} teratas)`,
        ``,
      ];

      displayed.forEach((item, idx) => {
        const pos = item.code || item.postalcode || "-";
        const desa = item.village || item.urban || "-";
        const kec = item.district || item.subdistrict || "-";
        const kab = item.regency || item.city || "-";
        const prov = item.province || "-";

        lines.push(`*${idx + 1}. Kode Pos: ${pos}*`);
        lines.push(`   🏠 Kel/Desa: ${desa}`);
        lines.push(`   📍 Kec: ${kec}`);
        lines.push(`   🏛️ Kab/Kota: ${kab}`);
        lines.push(`   🗺️ Prov: ${prov}`);
        lines.push(``);
      });

      if (total > 15) {
        lines.push(`_...dan ${total - 15} wilayah lainnya. Persempit kata kunci jika perlu._`);
      }

      return reply(lines.join("\n").trim());
    } catch (err) {
      return reply(`❌ Terjadi kesalahan saat mencari kode pos: ${err.message}`);
    }
  },
};
