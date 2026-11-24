const ANSWERS = [
  "Iya, tentu saja!",
  "Sangat mungkin terjadi.",
  "Tidak sama sekali.",
  "Kemungkinan besar iya.",
  "Coba tanyakan lagi nanti.",
  "Sulit untuk dipastikan saat ini.",
  "Jangan berharap terlalu banyak.",
  "Tanda-tanda mengarah ke iya!",
  "Pasti!",
  "Kurasa tidak.",
  "100% Benar!",
  "Mustahil.",
];

export default {
  name: "apakah",
  aliases: ["askbot", "kerangajaib"],
  description: "Jawaban acak Magic 8-Ball untuk segala pertanyaan Anda",
  usage: "<pertanyaan>",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const question = args.join(" ").trim();
    const p = prefix || ".";

    if (!question) {
      return reply(
        `*MAGIC 8-BALL (APAKAH)*\n\n` +
          `Format: \`${p}apakah <pertanyaan>\`\n` +
          `Contoh: \`${p}apakah hari ini akan hujan?\``
      );
    }

    await sendTyping();

    let hash = 0;
    const lower = question.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      hash = (hash * 31 + lower.charCodeAt(i)) % ANSWERS.length;
    }

    const index = Math.abs(hash + Math.floor(Date.now() / 60000)) % ANSWERS.length;
    const answer = ANSWERS[index];

    const text = `*MAGIC 8-BALL*\n` + `├─ Pertanyaan : ${question}\n` + `└─ Jawaban    : *${answer}*`;

    return reply(text);
  },
};
