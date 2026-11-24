export default {
  name: "regex",
  aliases: ["regextester", "regexcheck"],
  description: "Uji dan evaluasi ekspresi reguler (Regex) terhadap teks",
  usage: "/pattern/flags <teks>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const raw = args.join(" ").trim();

    if (!raw) {
      return reply(
        `┌── REGEX TESTER & MATCHER\n` +
          `│ Uji coba Regular Expression dengan teks target.\n` +
          `└──\n\n` +
          `Format: ${p}regex /<pattern>/<flags> <teks target>\n` +
          `Contoh: ${p}regex /\\d+/g Transaksi 123 berhasil pada hari 456\n` +
          `Contoh: ${p}regex /[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i Kirim ke admin@domain.com`
      );
    }

    const match = raw.match(/^\/(.*?)\/([a-z]*)\s+([\s\S]+)$/i);
    if (!match) {
      return reply(`❌ Format tidak cocok!\nGunakan sintaks regex standard: \`${p}regex /pattern/flags teks target\``);
    }

    const [, patternStr, flags, targetText] = match;

    try {
      const rx = new RegExp(patternStr, flags);
      const isGlobal = flags.includes("g");

      if (isGlobal) {
        const matches = [...targetText.matchAll(rx)];
        if (matches.length === 0) {
          return reply(
            `┌── REGEX EVALUATION\n` +
              `│ Pattern : /${patternStr}/${flags}\n` +
              `│ Status  : ❌ TIDAK COCOK (0 match)\n` +
              `└──`
          );
        }

        let text =
          `┌── REGEX EVALUATION\n` +
          `│ Pattern : /${patternStr}/${flags}\n` +
          `│ Status  : ✅ COCOK (${matches.length} matches)\n` +
          `└──\n\n`;

        matches.slice(0, 10).forEach((m, idx) => {
          const isLast = idx === Math.min(matches.length, 10) - 1;
          const branch = isLast ? "└──" : "├──";
          text += `${branch} [${idx + 1}] Nilai: "${m[0]}" (Index: ${m.index})\n`;
        });

        if (matches.length > 10) {
          text += `\n_Menampilkan 10 dari total ${matches.length} matches._`;
        }
        return reply(text);
      } else {
        const execMatch = rx.exec(targetText);
        if (!execMatch) {
          return reply(
            `┌── REGEX EVALUATION\n` + `│ Pattern : /${patternStr}/${flags}\n` + `│ Status  : ❌ TIDAK COCOK\n` + `└──`
          );
        }

        let text =
          `┌── REGEX EVALUATION\n` +
          `│ Pattern : /${patternStr}/${flags}\n` +
          `│ Status  : ✅ COCOK\n` +
          `├── Match : "${execMatch[0]}"\n` +
          `└── Pos   : Indeks ke-${execMatch.index}`;

        if (execMatch.length > 1) {
          text += `\n\n*Capture Groups*:`;
          for (let i = 1; i < execMatch.length; i++) {
            text += `\n├── Group ${i}: "${execMatch[i]}"`;
          }
        }
        return reply(text);
      }
    } catch (err) {
      return reply(`❌ Regex error: ${err.message}`);
    }
  },
};
