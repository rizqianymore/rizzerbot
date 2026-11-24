const QUOTES_LIST = [
  {
    quote: "Hiduplah seolah-olah kamu akan mati besok. Belajarlah seolah-olah kamu akan hidup selamanya.",
    author: "Mahatma Gandhi",
  },
  {
    quote: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah dengan mencintai apa yang kamu lakukan.",
    author: "Steve Jobs",
  },
  {
    quote: "Bermimpilah setinggi langit. Jika engkau jatuh, engkau akan jatuh di antara bintang-bintang.",
    author: "Ir. Soekarno",
  },
  {
    quote: "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan Anda dapat mengubah dunia.",
    author: "Nelson Mandela",
  },
  { quote: "Jangan menunggu waktu yang tepat, buatlah waktu tersebut menjadi tepat.", author: "Aristoteles" },
  { quote: "Kegagalan adalah satu-satunya kesempatan untuk memulai lagi dengan lebih cerdas.", author: "Henry Ford" },
  {
    quote:
      "Banyak hal yang bisa menjatuhkanmu, tapi satu-satunya hal yang benar-benar dapat menjatuhkanmu adalah sikapmu sendiri.",
    author: "R.A. Kartini",
  },
  { quote: "Ilmu tanpa amal adalah kegilaan, dan amal tanpa ilmu adalah kesia-siaan.", author: "Imam Al-Ghazali" },
];

export default {
  name: "katabijak",
  aliases: ["quotes", "motivasi", "kutipan"],
  description: "Kumpulan kutipan kata bijak, motivasi hidup, dan filosofi tokoh dunia",
  usage: "",
  category: "Tools",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const item = QUOTES_LIST[Math.floor(Math.random() * QUOTES_LIST.length)];

    const text = `*KATA BIJAK & MUTIARA HIDUP* 📜✨\n\n` + `"${item.quote}"\n\n` + `— *${item.author}*`;

    return reply(text);
  },
};
