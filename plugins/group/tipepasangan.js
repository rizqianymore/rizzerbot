const SIFAT_PASANGAN = [
  "Penyayang, perhatian, dan hobi kirim makanan pas kamu laper.",
  "Sedikit bawel tapi cerewetnya tanda cinta dan peduli.",
  "Humoris, selalu punya cara bikin kamu ketawa walau lagi sedih.",
  "Dewasa, pendengar yang baik, dan bisa diandalkan dalam segala hal.",
  "Cuek di luar tapi aslinya bucin parah di chat pribadi.",
  "Romantis, suka kasih kejutan kecil yang manis.",
];

export default {
  name: "tipepasangan",
  aliases: ["tipejodoh", "kriteriacinta"],
  description: "Cek seperti apa tipe dan kepribadian jodoh idealmu",
  usage: "[nama]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const name = args.join(" ").trim() || "Kamu";
    const trait = SIFAT_PASANGAN[Math.floor(Math.random() * SIFAT_PASANGAN.length)];

    const text = `*TIPE PASANGAN SEJATI* 🔮💑\n` + `├─ Pemilik Hati: *${name}*\n` + `└─ Karakter Doi: _${trait}_`;

    return reply(text);
  },
};
