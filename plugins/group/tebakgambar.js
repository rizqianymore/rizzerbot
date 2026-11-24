import { request } from "@/src/utils/request.js";

const FALLBACK_SOAL = [
  {
    imgUrl: "https://telegra.ph/file/0c9a29e46a5c1a79f8ad3.jpg",
    jawaban: "KACANG KEDELAI",
    clue: "Bahan pembuat tempe dan tahu",
  },
  {
    imgUrl: "https://telegra.ph/file/1569caef80a5e84860df8.jpg",
    jawaban: "PINTU RAHASIA",
    clue: "Akses masuk tersembunyi",
  },
];

const activeGames = new Map();

export default {
  name: "tebakgambar",
  aliases: ["tbkgambar", "tebakgbr"],
  description: "Tebak susunan gambar teka-teki visual",
  usage: "[jawaban / nyerah]",
  category: "Group",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const remoteJid = msg.key.remoteJid;
    const p = prefix || ".";
    const input = args.join(" ").trim().toUpperCase();

    const game = activeGames.get(remoteJid);

    if (game) {
      if (!input) {
        return reply(
          `*TEBAK GAMBAR SEDANG BERJALAN!*\n\n` +
            `Petunjuk: _${game.clue}_\n` +
            `Jumlah Huruf: ${game.jawaban.length} karakter\n\n` +
            `Ketik tebakan Anda atau ketik \`${p}tebakgambar nyerah\` untuk menyerah.`
        );
      }

      if (input === "NYERAH") {
        activeGames.delete(remoteJid);
        return reply(`*MENYERAH!*\n\nJawaban tebak gambar adalah: *${game.jawaban}*`);
      }

      if (input === game.jawaban) {
        activeGames.delete(remoteJid);
        return reply(
          `*TEBAKAN BENAR! 🖼️🎉*\n\n` +
            `Jawaban: *${game.jawaban}*\n` +
            `Petunjuk: _${game.clue}_\n\n` +
            `Penglihatan Anda sangat jeli!`
        );
      } else {
        return reply(`❌ Tebakan gambar belum tepat!`);
      }
    }

    await sendTyping();

    const q = FALLBACK_SOAL[Math.floor(Math.random() * FALLBACK_SOAL.length)];

    activeGames.set(remoteJid, {
      jawaban: q.jawaban,
      clue: q.clue,
      time: Date.now(),
    });

    const caption =
      `*TEBAK GAMBAR* 🖼️\n\n` +
      `Petunjuk: _${q.clue}_\n` +
      `Panjang Kata: ${q.jawaban.length} huruf\n\n` +
      `Jawab langsung di chat atau ketik \`${p}tebakgambar nyerah\`.`;

    try {
      const buf = await request.buffer(q.imgUrl, { timeout: 15000 });
      return sock.sendMessage(remoteJid, { image: buf, caption }, { quoted: msg });
    } catch (_) {
      return reply(caption);
    }
  },
};
