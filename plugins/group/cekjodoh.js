export default {
  name: "cekjodoh",
  aliases: ["jodoh", "match"],
  description: "Kalkulator kecocokan jodoh / pasangan berbasis algoritma nama",
  usage: "<nama 1> & <nama 2>",
  category: "Group",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const raw = args.join(" ").trim();
    const p = prefix || ".";

    if (!raw) {
      return reply(
        `*KALKULATOR CEK JODOH*\n\n` +
          `Gunakan format:\n` +
          `│ \`${p}cekjodoh Nama1 & Nama2\`\n` +
          `│ \`${p}jodoh Romeo dan Juliet\`\n\n` +
          `Contoh: \`${p}cekjodoh Dilan & Milea\``
      );
    }

    const parts = raw.split(/\s*(?:&|dan|with|\+|,)\s*/i);
    if (parts.length < 2) {
      return reply(`Pisahkan kedua nama dengan tanda \`&\` atau kata \`dan\`!\nContoh: \`${p}cekjodoh Andi & Siti\``);
    }

    await sendTyping();

    const name1 = parts[0].trim();
    const name2 = parts[1].trim();

    // Deterministic hash based on both names sorted
    const combined = [name1.toLowerCase(), name2.toLowerCase()].sort().join("::");
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31 + combined.charCodeAt(i)) % 1000000;
    }

    const percentage = 40 + (Math.abs(hash) % 60); // Range 40% - 99%

    let verdict = "Cukup Cocok — Perlu saling memahami dan komunikasi lebih dalam.";
    if (percentage >= 85) verdict = "Sangat Cocok — Pasangan serasi dan saling melengkapi!";
    else if (percentage >= 70) verdict = "Cocok — Hubungan harmonis dengan kecocokan tinggi.";
    else if (percentage < 55) verdict = "Banyak Ujian — Dibutuhkan kesabaran ekstra satu sama lain.";

    const text =
      `*HASIL CEK KECOCOKAN JODOH*\n` +
      `├─ Pasangan : *${name1}* ❤️ *${name2}*\n` +
      `├─ Skor     : *${percentage}%*\n` +
      `└─ Prediksi : ${verdict}`;

    return reply(text);
  },
};
