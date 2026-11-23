const SOULMATE_YEARS = [
  "Tahun ini juga! Siap-siap bertemu di tempat yang tak terduga.",
  "1 tahun lagi saat karier dan finansialmu mulai stabil.",
  "2 tahun lagi melalui perantara sahabat atau keluarga.",
  "3 tahun lagi, orangnya saat ini masih menyelesaikan masa lalunya.",
  "Jodohmu sebenarnya teman lama yang selama ini kamu abaikan!",
  "Masih menjadi misteri semesta, yang penting perbaiki diri dulu.",
];

export default {
  name: "kapanjodoh",
  aliases: ["kapanmenikah", "kapannikah"],
  description: "Prediksi ramalan kapan waktu kamu akan bertemu jodoh sejatimu",
  usage: "[nama]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = args.join(" ").trim() || "Kamu";
    const answer = SOULMATE_YEARS[Math.floor(Math.random() * SOULMATE_YEARS.length)];

    const text =
      `*RAMALAN JODOH & PERNIKAHAN* 💍✨\n` +
      `├─ Target    : ${target}\n` +
      `└─ Ramalan   : *${answer}*\n\n` +
      `_Hanya permainan hiburan, takdir terbaik tetap di tangan Tuhan._`;

    return reply(text);
  },
};
