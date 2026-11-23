const TEBAK_KATA_LIST = [
  { acak: "A-N-K-D-A-N-G", kata: "KANDANG", hint: "Tempat hewan ternak" },
  { acak: "P-E-S-W-A-A-T", kata: "PESAWAT", hint: "Kendaraan udara" },
  { acak: "G-A-N-J-I-B-E", kata: "BINTANG", hint: "Benda langit malam hari" },
  { acak: "M-A-T-H-A-A-I-R", kata: "MATAHARI", hint: "Pusat tata surya" },
  { acak: "K-O-M-P-U-E-T-R", kata: "KOMPUTER", hint: "Alat elektronik pengolah data" },
  { acak: "I-N-D-O-S-A-N-I-E", kata: "INDONESIA", hint: "Negara kepulauan zamrud khatulistiwa" },
  { acak: "H-A-R-M-O-N-I-S", kata: "HARMONIS", hint: "Serasi dan selaras" },
  { acak: "S-E-M-A-N-G-A-T", kata: "SEMANGAT", hint: "Dorongan antusiasme diri" },
];

const activeGames = new Map();

export default {
  name: "tebakkata",
  aliases: ["susunkata", "anagram"],
  description: "Permainan menyusun huruf acak menjadi kata bahasa Indonesia yang benar",
  usage: "[kata / nyerah]",
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
          `*TEBAK KATA SEDANG BERLANGSUNG!*\n\n` +
            `Susun Huruf: *${game.acak}*\n` +
            `Petunjuk: _${game.hint}_\n\n` +
            `Ketik jawaban Anda, atau \`${p}tebakkata nyerah\` jika menyerah.`
        );
      }

      if (input.toLowerCase() === "nyerah") {
        activeGames.delete(remoteJid);
        return reply(`*MENYERAH!*\n\nKata yang benar adalah: *${game.kata}*`);
      }

      if (input.toUpperCase() === game.kata.toUpperCase()) {
        activeGames.delete(remoteJid);
        return reply(
          `*HEBAT, JAWABAN BENAR! 🎯*\n\n` +
            `Kata: *${game.kata}*\n` +
            `Petunjuk: _${game.hint}_\n\n` +
            `Susunan kata Anda tepat 100%!`
        );
      } else {
        return reply(`❌ *Salah!* Susunan huruf belum tepat.`);
      }
    }

    await sendTyping();
    const item = TEBAK_KATA_LIST[Math.floor(Math.random() * TEBAK_KATA_LIST.length)];

    activeGames.set(remoteJid, {
      acak: item.acak,
      kata: item.kata,
      hint: item.hint,
      time: Date.now(),
    });

    const text =
      `*SUSUN KATA (ANAGRAM)* 🔤\n\n` +
      `Susun huruf berikut:\n` +
      `👉 *${item.acak}*\n\n` +
      `Petunjuk: _${item.hint}_\n` +
      `Ketik tebakan kata Anda sekarang!`;

    return reply(text);
  },
};
