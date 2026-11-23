const FAMILY_QUESTIONS = [
  {
    survey: "Sebutkan hewan berkaki empat yang sering dipelihara manusia!",
    jawaban: ["KUCING", "ANJING", "KAMBING", "SAPI", "KELINCI"],
  },
  {
    survey: "Sebutkan perlengkapan yang selalu dibawa saat hujan!",
    jawaban: ["PAYUNG", "JAS HUJAN", "JAKET", "SANDAL"],
  },
  {
    survey: "Sebutkan minuman yang biasa diminum saat sarapan pagi!",
    jawaban: ["KOPI", "TEH", "SUSU", "AIR PUTIH"],
  },
  {
    survey: "Sebutkan makanan khas Indonesia yang paling populer!",
    jawaban: ["RENDANG", "NASI GORENG", "SATE", "BAKSO", "SOTO"],
  },
];

const activeGames = new Map();

export default {
  name: "family100",
  aliases: ["survey100", "fam100"],
  description: "Kuis survei populer ala Family 100 untuk grup",
  usage: "[jawaban / pas / nyerah]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const remoteJid = msg.key.remoteJid;
    const p = prefix || ".";
    const input = args.join(" ").trim().toUpperCase();

    const game = activeGames.get(remoteJid);

    if (game) {
      if (!input) {
        let statusList = "";
        game.answers.forEach((ans, i) => {
          const isGuessed = game.found.includes(ans);
          statusList += `   ${i + 1}. ${isGuessed ? ans : "----------"}\n`;
        });

        return reply(
          `*FAMILY 100 SEDANG BERLANGSUNG!*\n\n` +
            `Pertanyaan: *${game.survey}*\n\n` +
            `Hasil Survei Tertebak:\n${statusList}\n` +
            `Ketik tebakan Anda langsung di chat!`
        );
      }

      if (input === "NYERAH") {
        activeGames.delete(remoteJid);
        return reply(
          `*GAME BERAKHIR (MENYERAH)*\n\n` +
            `Semua Jawaban Survei:\n` +
            game.answers.map((a, i) => `   ${i + 1}. ${a}`).join("\n")
        );
      }

      const matchIdx = game.answers.findIndex((a) => a === input || a.includes(input));
      if (matchIdx !== -1) {
        const foundWord = game.answers[matchIdx];
        if (game.found.includes(foundWord)) {
          return reply(`Jawaban *${foundWord}* sudah pernah ditebak sebelumnya!`);
        }

        game.found.push(foundWord);

        let statusList = "";
        game.answers.forEach((ans, i) => {
          const isGuessed = game.found.includes(ans);
          statusList += `   ${i + 1}. ${isGuessed ? `*${ans}* (Ditebak)` : "----------"}\n`;
        });

        if (game.found.length === game.answers.length) {
          activeGames.delete(remoteJid);
          return reply(
            `*SURVEI SELESAI DITEBAK SEMUA! 🏆*\n\n` +
              `Semua poin jawaban survei berhasil terungkap:\n${statusList}\n` +
              `Kekompakan grup luar biasa!`
          );
        }

        return reply(
          `*TEBAKAN TEPAT! 🎯*\n\n` +
            `Poin survei bertambah!\n${statusList}\n` +
            `Sisa ${game.answers.length - game.found.length} jawaban lagi.`
        );
      } else {
        return reply(`❌ Jawaban tidak ada dalam hasil survei teratas.`);
      }
    }

    await sendTyping();
    const item = FAMILY_QUESTIONS[Math.floor(Math.random() * FAMILY_QUESTIONS.length)];

    activeGames.set(remoteJid, {
      survey: item.survey,
      answers: item.jawaban,
      found: [],
      time: Date.now(),
    });

    const statusList = item.jawaban.map((_, i) => `   ${i + 1}. ----------`).join("\n");

    const text =
      `*KUIS FAMILY 100* 📋\n\n` +
      `Survei membuktikan:\n` +
      `*${item.survey}*\n\n` +
      `Daftar Jawaban Survei (${item.jawaban.length}):\n${statusList}\n\n` +
      `Ketik tebakan Anda langsung di chat grup, atau ketik \`${p}family100 nyerah\`.`;

    return reply(text);
  },
};
