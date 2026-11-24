export default {
  name: "timestamp",
  aliases: ["epoch", "unixtime", "timeconvert"],
  description: "Konversi Unix Epoch Timestamp ke tanggal WIB/UTC atau sebaliknya",
  usage: "[timestamp / tanggal]",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const input = args.join(" ").trim();

    let dateObj = new Date();

    if (input) {
      if (/^\d{10}$/.test(input)) {
        // 10 digits = seconds
        dateObj = new Date(Number(input) * 1000);
      } else if (/^\d{13}$/.test(input)) {
        // 13 digits = milliseconds
        dateObj = new Date(Number(input));
      } else {
        const parsed = Date.parse(input);
        if (isNaN(parsed)) {
          return reply(
            `❌ Format tidak dikenali!\n\n` +
              `Gunakan:\n` +
              `├── Timestamp detik: \`${p}timestamp 1732320000\`\n` +
              `├── Timestamp milidetik: \`${p}timestamp 1732320000000\`\n` +
              `└── Format tanggal: \`${p}timestamp 2026-11-24 15:30:00\``
          );
        }
        dateObj = new Date(parsed);
      }
    }

    const sec = Math.floor(dateObj.getTime() / 1000);
    const ms = dateObj.getTime();

    const wibStr = dateObj.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "long",
    });

    const utcStr = dateObj.toUTCString();
    const isoStr = dateObj.toISOString();

    const text =
      `┌── UNIX TIMESTAMP & DATE CONVERTER\n` +
      `│ Epoch Detik : \`${sec}\`\n` +
      `│ Epoch Milis : \`${ms}\`\n` +
      `└──\n\n` +
      `├── Waktu WIB : ${wibStr}\n` +
      `├── Waktu UTC : ${utcStr}\n` +
      `└── Format ISO: \`${isoStr}\``;

    return reply(text);
  },
};
