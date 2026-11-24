export default {
  name: "ascii",
  aliases: ["asciitext", "asciitable", "charcode"],
  description: "Lihat tabel kode karakter ASCII, Decimal, Hex, dan konversi karakter",
  usage: "<karakter / kode angka / teks>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `┌── ASCII & CHAR CODE INSPECTOR\n` +
          `│ Konversi teks ke Decimal, Hex, Biner ASCII atau sebaliknya.\n` +
          `└──\n\n` +
          `Format: ${p}ascii <karakter atau angka>\n` +
          `Contoh: ${p}ascii A\n` +
          `Contoh: ${p}ascii Hello\n` +
          `Contoh: ${p}ascii 65`
      );
    }

    // Jika input adalah 1 angka decimal
    if (/^\d{1,3}$/.test(input) && Number(input) <= 255) {
      const code = Number(input);
      const char = String.fromCharCode(code);
      const hex = code.toString(16).toUpperCase().padStart(2, "0");
      const bin = code.toString(2).padStart(8, "0");

      return reply(
        `┌── ASCII CODE DETAIL\n` +
          `│ Kode Decimal : ${code}\n` +
          `└──\n\n` +
          `├── Karakter : *${char}*\n` +
          `├── Hex      : \`0x${hex}\`\n` +
          `├── Biner    : \`${bin}\`\n` +
          `└── HTML Ent : \`&#${code};\``
      );
    }

    // Jika input teks
    const chars = input.slice(0, 12).split("");
    let text = `┌── ASCII BREAKDOWN (${chars.length} Karakter)\n` + `│ Teks : "${input.slice(0, 25)}"\n` + `└──\n\n`;

    chars.forEach((c, idx) => {
      const isLast = idx === chars.length - 1;
      const branch = isLast ? "└──" : "├──";
      const subPipe = isLast ? "   " : "│  ";
      const dec = c.charCodeAt(0);
      const hex = dec.toString(16).toUpperCase().padStart(2, "0");
      const bin = dec.toString(2).padStart(8, "0");

      text += `${branch} [${c}] Decimal: ${dec}\n`;
      text += `${subPipe} Hex: 0x${hex} | Bin: ${bin}\n`;
    });

    return reply(text);
  },
};
