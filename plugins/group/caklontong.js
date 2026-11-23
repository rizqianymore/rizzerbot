const CAK_LONTONG_QUESTIONS = [
  {
    soal: "Makan nasi goreng enaknya pakai...",
    jawaban: "Sendok",
    deskripsi: "Ya masa pakai cangkul! Kan makan nasi, bukan gali tanah.",
  },
  {
    soal: "Burung terbang menggunakan...",
    jawaban: "Semangat",
    deskripsi: "Kalau burungnya males dan gak ada semangat, ya gak bakal terbang jalan kaki aja.",
  },
  {
    soal: "Banteng menyerang karena melihat warna...",
    jawaban: "Kandang",
    deskripsi: "Banteng kalau gak liat kandangnya ya kabur, bukan nyerang.",
  },
  {
    soal: "Orang menyeberang jalan lewat...",
    jawaban: "Sore",
    deskripsi: "Kalau lewat subuh masih gelap, sepi banget bahaya ketabrak.",
  },
  {
    soal: "Malam hari biasanya kita tidur di...",
    jawaban: "Rumah",
    deskripsi: "Kalau tidur di tengah jalan tol ditabrak truk dong.",
  },
  {
    soal: "Sebelum minum obat kita harus...",
    jawaban: "Sakit",
    deskripsi: "Ngapain minum obat kalau gak sakit? Cari sensasi?",
  },
  {
    soal: "Kendaraan yang punya roda tiga adalah...",
    jawaban: "Banyak",
    deskripsi: "Bajaj ada banyak, bemo ada banyak, becak juga ada banyak di jalan.",
  },
  {
    soal: "Garam rasanya...",
    jawaban: "Kasar",
    deskripsi: "Kalau garam dapur yang belum halus ya teksturnya kasar.",
  },
];

// Session game aktif per remoteJid
const activeGames = new Map();

export default {
  name: "caklontong",
  aliases: ["lontong", "tebaklontong"],
  description: "Tebak-tebakan logika plesetan khas Cak Lontong",
  usage: "[jawaban / nyerah / bantuan]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const remoteJid = msg.key.remoteJid;
    const p = prefix || ".";
    const input = args.join(" ").trim();

    const game = activeGames.get(remoteJid);

    // Jika sedang ada soal aktif
    if (game) {
      if (!input) {
        return reply(
          `*GAME CAK LONTONG MASIH BERJALAN!*\n\n` +
            `Soal: *${game.soal}*\n` +
            `Petunjuk: \`${game.clue}\` (${game.jawaban.length} huruf)\n\n` +
            `Ketik jawaban Anda, atau ketik \`${p}caklontong nyerah\` untuk mengakhiri.`
        );
      }

      if (input.toLowerCase() === "nyerah") {
        activeGames.delete(remoteJid);
        return reply(
          `*MENYERAH!*\n\n` + `Jawaban yang benar: *${game.jawaban}*\n` + `Alasan Cak Lontong: _${game.deskripsi}_`
        );
      }

      if (input.toLowerCase() === game.jawaban.toLowerCase()) {
        activeGames.delete(remoteJid);
        return reply(
          `*BENAR SEKALI! 🎉*\n\n` +
            `Jawaban: *${game.jawaban}*\n` +
            `Alasan: _${game.deskripsi}_\n\n` +
            `Selamat! Anda memahami logika Cak Lontong.`
        );
      } else {
        return reply(`❌ *Salah!* Pikirkan baik-baik logika khas Cak Lontong...`);
      }
    }

    // Buat soal baru
    await sendTyping();
    const q = CAK_LONTONG_QUESTIONS[Math.floor(Math.random() * CAK_LONTONG_QUESTIONS.length)];

    // Buat clue (huruf pertama dan strip)
    const clue = q.jawaban
      .split("")
      .map((c, i) => (i === 0 || i === q.jawaban.length - 1 ? c : "_"))
      .join(" ");

    activeGames.set(remoteJid, {
      soal: q.soal,
      jawaban: q.jawaban,
      deskripsi: q.deskripsi,
      clue,
      time: Date.now(),
    });

    const text =
      `*TEBAK-TEBAKAN CAK LONTONG*\n\n` +
      `Soal: *${q.soal}*\n` +
      `Petunjuk: \`${clue}\` (${q.jawaban.length} huruf)\n\n` +
      `Kirim jawaban Anda langsung di chat, atau ketik \`${p}caklontong nyerah\` jika pusing!`;

    return reply(text);
  },
};
