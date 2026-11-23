const DRIFT_REASONS = [
  "Doi lagi asyik chatan sama yang lebih fast response.",
  "Bukan cuek, doi emang gak ada rasa aja dari awal.",
  "Doi ketiduran, tapi aktif di second account Instagram.",
  "Lagi bingung cara nolak kamu secara halus tanpa bikin tersinggung.",
  "Kamu cuma dijadiin badut pas doi lagi bosen.",
  "Doi sebenarnya sibuk beneran, jangan overthinking mulu!",
  "Doi nunggu kamu yang mulai chat duluan karena gengsi.",
  "Chat kamu tenggelam sama list chat gebetan doi yang lain.",
];

export default {
  name: "kenapacuek",
  aliases: ["doicuek", "alasancuek"],
  description: "Mencari tahu alasan kenapa doi mendadak dingin dan cuek ke kamu",
  usage: "",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const reason = DRIFT_REASONS[Math.floor(Math.random() * DRIFT_REASONS.length)];

    const text =
      `*KENAPA DOI CUEK?* 🧊💔\n\n` +
      `Hasil analisa bot:\n` +
      `👉 _"${reason}"_\n\n` +
      `Saran bot: Mending mundur perlahan atau seduh kopi biar gak overthinking!`;

    return reply(text);
  },
};
