export default {
  name: "diff",
  aliases: ["textdiff", "comparediff", "diffcheck"],
  description: "Bandingkan perbedaan antara dua teks baris per baris",
  usage: "<teks1> | <teks2>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const full = args.join(" ").trim();

    if (!full || !full.includes("|")) {
      return reply(
        `┌── TEXT DIFF CHECKER\n` +
          `│ Bandingkan perbedaan isi dua buah teks.\n` +
          `└──\n\n` +
          `Format: ${p}diff <teks asli> | <teks revisi>\n` +
          `Contoh: ${p}diff apel mangga jeruk | apel pisang jeruk`
      );
    }

    const [leftRaw, rightRaw] = full.split("|");
    const leftWords = leftRaw.trim().split(/\s+/);
    const rightWords = rightRaw.trim().split(/\s+/);

    const added = rightWords.filter((w) => !leftWords.includes(w));
    const removed = leftWords.filter((w) => !rightWords.includes(w));
    const same = leftWords.filter((w) => rightWords.includes(w));

    let text =
      `┌── PERBANDINGAN TEKS (DIFF)\n` +
      `│ Status : ${added.length === 0 && removed.length === 0 ? "Sama Persis" : "Terdapat Perbedaan"}\n` +
      `└──\n\n`;

    if (added.length > 0) {
      text += `├── [+] Ditambahkan (${added.length}):\n│   ${added.map((w) => `+ ${w}`).join("\n│   ")}\n│\n`;
    }
    if (removed.length > 0) {
      text += `├── [-] Dihapus (${removed.length}):\n│   ${removed.map((w) => `- ${w}`).join("\n│   ")}\n│\n`;
    }

    text += `└── [=] Kata Sama (${same.length}): ${same.join(", ") || "-"}`;
    return reply(text);
  },
};
