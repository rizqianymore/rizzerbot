const GAMBLING_CHANCES = [
  { chance: 95, desc: "Peluang Emas! Doi sering curi pandang dan nungguin kamu gerak duluan." },
  { chance: 80, desc: "Peluang Besar! Doi merasa nyaman ngobrol lama sama kamu." },
  { chance: 60, desc: "50:50. Doi masih anggap kamu teman dekat, butuh sedikit kejutan." },
  { chance: 40, desc: "Agak Berisiko. Doi lagi dekat sama orang lain juga." },
  { chance: 15, desc: "Peluang Tipis. Doi cuma anggap kamu abang-abangan / adik-adikan." },
  { chance: 5, desc: "ZONK! Mending putar balik sebelum sakit hati lebih parah." },
];

export default {
  name: "peluangjadian",
  aliases: ["peluang", "chancelove", "chancejadian"],
  description: "Cek estimasi peluang kamu bisa jadian sama target/crush",
  usage: "<nama target>",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const crush = args.join(" ").trim();
    const p = prefix || ".";

    if (!crush) {
      return reply(
        `*PELUANG JADIAN CHECKER*\n\n` +
          `Format: \`${p}peluangjadian <nama gebetan/crush>\`\n` +
          `Contoh: \`${p}peluangjadian Chelsea Islan\``
      );
    }

    await sendTyping();

    const item = GAMBLING_CHANCES[Math.floor(Math.random() * GAMBLING_CHANCES.length)];

    const text =
      `*ANALISA PELUANG JADIAN* 💘📈\n` +
      `├─ Target Crush : *${crush}*\n` +
      `├─ Peluang      : *${item.chance}%*\n` +
      `└─ Kesimpulan   : ${item.desc}`;

    return reply(text);
  },
};
