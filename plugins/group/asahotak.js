const ASAH_OTAK_QUESTIONS = [
  {
    soal: "Ada satu keluarga punya 5 anak perempuan, dan masing-masing anak perempuan punya 1 saudara laki-laki. Berapa total anak dalam keluarga itu?",
    jawaban: "6",
    petunjuk: "Saudara laki-lakinya sama untuk semua anak perempuan.",
  },
  {
    soal: "Semakin banyak kamu mengambil dariku, semakin besar aku jadinya. Apakah aku?",
    jawaban: "Lubang",
    petunjuk: "Terdapat di tanah atau pakaian.",
  },
  {
    soal: "Benda apa yang selalu datang tapi tidak pernah benar-benar tiba?",
    jawaban: "Besok",
    petunjuk: "Waktu masa depan.",
  },
  {
    soal: "Aku punya leher tapi tidak punya kepala. Siapakah aku?",
    jawaban: "Baju",
    petunjuk: "Benda yang kita pakai sehari-hari.",
  },
  {
    soal: "Benda apa yang basah saat sedang mengeringkan?",
    jawaban: "Handuk",
    petunjuk: "Dipakai sehabis mandi.",
  },
  {
    soal: "Bila dibalik akan berkurang nilainya 3. Angka berapakah itu?",
    jawaban: "9",
    petunjuk: "Angka satuan diputar 180 derajat jadi 6.",
  },
  {
    soal: "Aku punya kota tapi tak berpohon, punya sungai tapi tak berair, punya jalan tapi tak bermobil. Apakah aku?",
    jawaban: "Peta",
    petunjuk: "Gambaran permukaan bumi.",
  },
];

const activeGames = new Map();

export default {
  name: "asahotak",
  aliases: ["tekateki", "brain"],
  description: "Teka-teki asah otak interaktif untuk menguji kecerdasan",
  usage: "[jawaban / nyerah]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const remoteJid = msg.key.remoteJid;
    const p = prefix || ".";
    const input = args.join(" ").trim();

    const game = activeGames.get(remoteJid);

    if (game) {
      if (!input) {
        return reply(
          `*ASAH OTAK SEDANG BERLANGSUNG!*\n\n` +
            `Teka-teki: *${game.soal}*\n` +
            `Bantuan: _${game.petunjuk}_\n\n` +
            `Ketik jawaban Anda, atau ketik \`${p}asahotak nyerah\` untuk menyerah.`
        );
      }

      if (input.toLowerCase() === "nyerah") {
        activeGames.delete(remoteJid);
        return reply(`*MENYERAH!*\n\nJawaban yang benar adalah: *${game.jawaban}*\nPenjelasan: _${game.petunjuk}_`);
      }

      if (input.toLowerCase() === game.jawaban.toLowerCase()) {
        activeGames.delete(remoteJid);
        return reply(
          `*JAWABAN TEPAT! 🧠✨*\n\n` +
            `Jawaban: *${game.jawaban}*\n` +
            `Penjelasan: _${game.petunjuk}_\n\n` +
            `Otak Anda sangat encer!`
        );
      } else {
        return reply(`❌ *Jawaban belum tepat!* Coba renungkan lagi pertanyaannya.`);
      }
    }

    await sendTyping();
    const q = ASAH_OTAK_QUESTIONS[Math.floor(Math.random() * ASAH_OTAK_QUESTIONS.length)];

    activeGames.set(remoteJid, {
      soal: q.soal,
      jawaban: q.jawaban,
      petunjuk: q.petunjuk,
      time: Date.now(),
    });

    const text =
      `*TEKA-TEKI ASAH OTAK* 🧠\n\n` +
      `Pertanyaan: *${q.soal}*\n\n` +
      `Ketik jawaban langsung di chat atau \`${p}asahotak nyerah\` jika menyerah!`;

    return reply(text);
  },
};
