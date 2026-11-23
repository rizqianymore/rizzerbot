const LOVE_TIPS = [
  "Jangan terlalu cepat membalas chat dalam hitungan detik jika doi membalasmu berjam-jam. Jaga nilai dirimu.",
  "Cinta sejati itu saling melengkapi kekurangan, bukan menuntut kesempurnaan.",
  "Kunci hubungan langgeng ada 3: Komunikasi jujur, saling percaya, dan tahu batasan ego.",
  "Jika kamu harus terus-terusan mengemis kepastian, itu tanda bahwa kamu berada di pelabuhan yang salah.",
  "Beri ruang untuk doi dan dirimu sendiri bertumbuh. Hubungan sehat tidak membuat salah satu pihak merasa terkekang.",
  "Pria jatuh cinta lewat apa yang dia lihat dan rasakan, wanita jatuh cinta lewat apa yang dia dengar dan perlakuan tulus.",
  "Jangan pernah membandingkan pasanganmu dengan masa lalu siapa pun.",
];

export default {
  name: "tipscinta",
  aliases: ["saranpercintaan", "cintatips", "lovetips"],
  description: "Saran dan tips bijak seputar hubungan asmara, PDKT, dan percintaan",
  usage: "",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const tip = LOVE_TIPS[Math.floor(Math.random() * LOVE_TIPS.length)];

    const text =
      `*TIPS PERCINTAAN & HUBUNGAN* 💡🌹\n\n` +
      `"${tip}"\n\n` +
      `_Terapkan dalam hubunganmu agar makin dewasa dan harmonis._`;

    return reply(text);
  },
};
