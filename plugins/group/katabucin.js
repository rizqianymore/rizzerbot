const BUCIN_QUOTES = [
  "Bukan karena tak ada yang lain, tapi karena hatiku sudah memilihmu dan mengunci pintunya untuk selamanya.",
  "Mencintaimu itu seperti bernapas, bagaimana bisa aku berhenti jika tanpamu hidupku selesai?",
  "Jika mencintaimu adalah sebuah kesalahan, maka aku tidak pernah ingin menjadi benar seumur hidupku.",
  "Rindu itu berat, tapi lebih berat lagi kalau harus pura-pura biasa saja saat melihatmu tersenyum.",
  "Aku tidak butuh dunia yang sempurna, aku cuma butuh kamu ada di setiap ceritaku.",
  "Orang bilang rumah adalah tempat kita berteduh, tapi bagiku, rumah adalah pelukan hangatmu.",
  "Walaupun jarak kita terbentang jauh, doa dan cintaku selalu tiba lebih cepat daripada rindu.",
  "Jatuh cinta kepadamu adalah keputusan paling indah yang tak pernah aku sesali.",
];

export default {
  name: "katabucin",
  aliases: ["bucin", "quotesbucin", "bucinquote"],
  description: "Kumpulan kata-kata mutiara dan quotes bucin menyentuh hati",
  usage: "",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const quote = BUCIN_QUOTES[Math.floor(Math.random() * BUCIN_QUOTES.length)];
    const text = `*QUOTES BUCIN* 🥀🤍\n\n` + `"${quote}"\n\n` + `_Tersimpan rapi di dalam sudut hati terdalam._`;

    return reply(text);
  },
};
