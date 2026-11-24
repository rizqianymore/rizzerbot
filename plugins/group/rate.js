export default {
  name: "rate",
  aliases: ["nilaiku", "nilai", "cekrate"],
  description: "Bot memberikan penilaian rating persentase secara acak",
  usage: "<teks / hal yang dinilai>",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const subject = args.join(" ").trim();
    const p = prefix || ".";

    if (!subject) {
      return reply(
        `*RATING CHECKER*\n\n` +
          `Format: \`${p}rate <hal yang dinilai>\`\n` +
          `Contoh:\n` +
          `│ \`${p}rate ketampanan saya\`\n` +
          `│ \`${p}rate masakan pacar\``
      );
    }

    await sendTyping();

    const score = Math.floor(Math.random() * 101);

    let verdict = "Biasa saja.";
    if (score >= 90) verdict = "Luar biasa sempurna! ⭐⭐⭐⭐⭐";
    else if (score >= 75) verdict = "Bagus sekali dan sangat memuaskan!";
    else if (score >= 50) verdict = "Lumayan, cukup standar.";
    else if (score >= 25) verdict = "Kurang memuaskan, butuh banyak perbaikan.";
    else verdict = "Parah banget, mending jangan deh...";

    const text =
      `*PENILAIAN BOT*\n` + `├─ Target   : ${subject}\n` + `├─ Rating   : *${score}%*\n` + `└─ Catatan  : ${verdict}`;

    return reply(text);
  },
};
