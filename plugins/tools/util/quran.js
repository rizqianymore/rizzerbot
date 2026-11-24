import { request } from "@/src/utils/request.js";

export default {
  name: "quran",
  aliases: ["surah", "ayat", "alquran"],
  description: "Tampilkan surat dan ayat Al-Qur'an lengkap (teks Arab, Latin, dan terjemahan Kemenag)",
  usage: "<nomor surat / nama surat> [nomor ayat]",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `*AL-QUR'AN DIGITAL*\n\n` +
          `Format: \`${p}quran <nomor/nama surat> [nomor ayat]\`\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}quran 1\` (Surah Al-Fatihah)\n` +
          `│ \`${p}quran 2 255\` (Ayat Kursi)\n` +
          `│ \`${p}quran yasin 1-5\``
      );
    }

    await sendTyping();
    const query = args[0].toLowerCase();
    const ayatArg = args[1];

    try {
      // Ambil daftar surat jika input nama
      let surahNumber = parseInt(query, 10);
      if (isNaN(surahNumber)) {
        const list = await request.json("https://equran.id/api/v2/surat", { timeout: 15000 });
        const found = list.data?.find(
          (s) => s.namaLatin.toLowerCase().includes(query) || s.arti.toLowerCase().includes(query)
        );
        if (!found) {
          return reply(`Surat "${query}" tidak ditemukan. Gunakan nomor 1 - 114.`);
        }
        surahNumber = found.nomor;
      }

      const res = await request.json(`https://equran.id/api/v2/surat/${surahNumber}`, { timeout: 20000 });
      const data = res.data;
      if (!data) return reply("Gagal mengambil data surat.");

      let text = `*SURAH ${data.namaLatin.toUpperCase()} (${data.nama})*\n`;
      text += `├─ Arti       : ${data.arti}\n`;
      text += `├─ Jumlah     : ${data.jumlahAyat} Ayat (${data.tempatTurun})\n`;
      text += `└─ Audio Full : ${data.audioFull?.["05"] || data.audioFull?.["01"] || "-"}\n\n`;

      let ayatList = data.ayat || [];
      if (ayatArg) {
        if (ayatArg.includes("-")) {
          const [start, end] = ayatArg.split("-").map((n) => parseInt(n, 10));
          ayatList = ayatList.filter((a) => a.nomorAyat >= start && a.nomorAyat <= end);
        } else {
          const single = parseInt(ayatArg, 10);
          ayatList = ayatList.filter((a) => a.nomorAyat === single);
        }
      } else {
        // Tampilkan 3 ayat pertama jika tidak spesifik agar chat tidak kepanjangan
        ayatList = ayatList.slice(0, 3);
      }

      if (!ayatList.length) {
        return reply(`Ayat tidak ditemukan dalam Surah ${data.namaLatin}.`);
      }

      for (const a of ayatList) {
        text += `*Ayat ${a.nomorAyat}:*\n`;
        text += `${a.teksArab}\n`;
        text += `_${a.teksLatin}_\n`;
        text += `Artinya: "${a.teksIndonesia}"\n\n`;
      }

      if (!ayatArg && data.jumlahAyat > 3) {
        text += `_Menampilkan 3 dari ${data.jumlahAyat} ayat. Ketik \`${p}quran ${surahNumber} 1-10\` untuk ayat spesifik._`;
      }

      return reply(text.trim());
    } catch (err) {
      return reply(`Gagal memuat Al-Qur'an: ${err.message}`);
    }
  },
};
