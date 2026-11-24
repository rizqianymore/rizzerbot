function explainCronPart(val, type) {
  if (val === "*") return `setiap ${type}`;
  if (val.startsWith("*/")) return `setiap ${val.slice(2)} ${type}`;
  if (val.includes(",")) return `pada ${type} ${val}`;
  if (val.includes("-")) return `mulai ${type} ${val.replace("-", " s/d ")}`;
  return `pada ${type} ke-${val}`;
}

export default {
  name: "cron",
  aliases: ["cronexplain", "cronparse", "crontab"],
  description: "Terjemahkan ekspresi jadwal Cron ke bahasa manusia & simulasi waktu jalan",
  usage: "<ekspresi cron 5 bagian>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const expr = args.join(" ").trim();

    if (!expr) {
      return reply(
        `┌── CRON EXPRESSION EXPLAINER\n` +
          `│ Terjemahkan jadwal cron ke bahasa manusia.\n` +
          `└──\n\n` +
          `Format: ${p}cron <menit> <jam> <hari-bln> <bulan> <hari-minggu>\n\n` +
          `Contoh Populer:\n` +
          `├── \`${p}cron */5 * * * *\` (Setiap 5 menit)\n` +
          `├── \`${p}cron 0 0 * * *\` (Tengah malam setiap hari)\n` +
          `├── \`${p}cron 0 7 * * 1-5\` (Senin s/d Jumat jam 07:00)\n` +
          `└── \`${p}cron 30 14 1 * *\` (Tiap tanggal 1 jam 14:30)`
      );
    }

    const parts = expr.split(/\s+/);
    if (parts.length < 5) {
      return reply(
        `❌ Format cron tidak lengkap! Cron standar membutuhkan 5 field: \`<menit> <jam> <hari> <bulan> <hari-minggu>\``
      );
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const daysMap = {
      0: "Minggu",
      1: "Senin",
      2: "Selasa",
      3: "Rabu",
      4: "Kamis",
      5: "Jumat",
      6: "Sabtu",
      7: "Minggu",
    };

    let descHari = explainCronPart(dayOfWeek, "hari");
    if (/^[0-7]$/.test(dayOfWeek)) {
      descHari = `setiap hari ${daysMap[dayOfWeek]}`;
    }

    let text =
      `┌── JADWAL CRON EXPLAINER\n` +
      `│ Ekspresi : \`${expr}\`\n` +
      `└──\n\n` +
      `├── [1] Menit       : ${explainCronPart(minute, "menit")}\n` +
      `├── [2] Jam         : ${explainCronPart(hour, "jam")}\n` +
      `├── [3] Tgl / Bulan : ${explainCronPart(dayOfMonth, "tanggal")}\n` +
      `├── [4] Bulan       : ${explainCronPart(month, "bulan")}\n` +
      `└── [5] Hari Minggu : ${descHari}\n\n`;

    // Ringkasan sederhana
    let summary = "Berjalan ";
    if (minute === "*" && hour === "*") {
      summary += "setiap menit sepanjang waktu.";
    } else if (minute.startsWith("*/") && hour === "*") {
      summary += `setiap ${minute.slice(2)} menit secara berkala.`;
    } else if (hour !== "*" && minute !== "*") {
      summary += `pada pukul ${hour.padStart(2, "0")}:${minute.padStart(2, "0")} WIB `;
      summary += dayOfWeek !== "*" ? `(${descHari}).` : "setiap hari.";
    } else {
      summary += "sesuai aturan ekspresi di atas.";
    }

    text += `*Ringkasan*: ${summary}`;
    return reply(text);
  },
};
