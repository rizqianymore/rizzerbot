const PERIBAHASA_DATABASE = [
  {
    peribahasa: "Air tenang menghanyutkan.",
    arti: "Orang yang pendiam biasanya memiliki banyak ilmu atau berbahaya jika diprovokasi.",
  },
  {
    peribahasa: "Bagai air di daun talas.",
    arti: "Orang yang tidak berpendirian tetap dan selalu berubah-ubah pikirannya.",
  },
  {
    peribahasa: "Tong kosong nyaring bunyinya.",
    arti: "Orang yang banyak bicara dan menyombongkan diri biasanya sedikit ilmunya.",
  },
  {
    peribahasa: "Ada udang di balik batu.",
    arti: "Ada maksud tersembunyi di balik suatu tindakan atau perkataan manis.",
  },
  {
    peribahasa: "Berat sama dipikul, ringan sama dijinjing.",
    arti: "Bersama-sama dalam suka maupun duka, saling tolong-menolong.",
  },
  {
    peribahasa: "Nasi sudah menjadi bubur.",
    arti: "Perbuatan yang sudah terlanjur terjadi dan tidak bisa diulang atau diperbaiki lagi.",
  },
  {
    peribahasa: "Gajah di pelupuk mata tak tampak, semut di seberang lautan tampak.",
    arti: "Kesalahan diri sendiri yang besar tidak disadari, tapi kesalahan kecil orang lain selalu dicari-cari.",
  },
  {
    peribahasa: "Sedia payung sebelum hujan.",
    arti: "Bersiap sedia menghadapi segala kemungkinan sebelum kesulitan menimpa.",
  },
];

export default {
  name: "peribahasa",
  aliases: ["pepatah", "ungkapan"],
  description: "Cari arti dan makna peribahasa nusantara",
  usage: "[kata kunci (opsional)]",
  category: "Tools & Media",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const query = args.join(" ").toLowerCase().trim();
    const p = prefix || ".";

    if (!query) {
      const item = PERIBAHASA_DATABASE[Math.floor(Math.random() * PERIBAHASA_DATABASE.length)];
      const text =
        `*PERIBAHASA NUSANTARA* 📜\n\n` +
        `"${item.peribahasa}"\n\n` +
        `*Makna / Arti:*\n_${item.arti}_\n\n` +
        `_Ketik \`${p}peribahasa <kata>\` untuk mencari peribahasa terkait._`;

      return reply(text);
    }

    const matches = PERIBAHASA_DATABASE.filter(
      (pItem) => pItem.peribahasa.toLowerCase().includes(query) || pItem.arti.toLowerCase().includes(query)
    );

    if (!matches.length) {
      return reply(`Peribahasa dengan kata kunci "*${query}*" tidak ditemukan.`);
    }

    const item = matches[0];
    const text = `*PERIBAHASA NUSANTARA* 📜\n\n` + `"${item.peribahasa}"\n\n` + `*Makna / Arti:*\n_${item.arti}_`;

    return reply(text);
  },
};
