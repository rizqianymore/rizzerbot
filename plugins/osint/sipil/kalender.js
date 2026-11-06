const PASARAN = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Hari Libur Nasional Tetap Indonesia
const LIBUR_NASIONAL_TETAP = {
  "01-01": "Tahun Baru Masehi",
  "05-01": "Hari Buruh Internasional",
  "06-01": "Hari Lahir Pancasila",
  "08-17": "Hari Kemerdekaan Republik Indonesia (HUT RI)",
  "12-25": "Hari Raya Natal",
};

/**
 * Menghitung Pasaran Jawa (Legi, Pahing, Pon, Wage, Kliwon)
 * 1 Januari 1970 UTC = Kamis Wage (index 3)
 */
export function getPasaranJawa(date) {
  const utcDays = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return PASARAN[((utcDays % 5) + 5 + 3) % 5];
}

/**
 * Mengonversi tanggal Masehi ke Kalender Hijriah (Umm al-Qura) menggunakan Intl native Node.js
 */
export function getKalenderHijriah(date) {
  try {
    const formatter = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatter.format(date);
  } catch {
    return "-";
  }
}

export default {
  name: "kalender",
  aliases: ["weton", "pasaran", "hijriah", "harilibur", "tgl"],
  description: "Cek tanggal Masehi, Hijriah, Weton/Pasaran Jawa, dan informasi hari libur sipil",
  usage: "[tanggal (opsional, cth: 2026-11-06 atau 17-08-1945)]",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let targetDate = new Date();

    if (args.length > 0) {
      const input = args.join(" ").trim();
      // Dukung format YYYY-MM-DD atau DD-MM-YYYY
      const dmy = input.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      const ymd = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

      if (dmy) {
        targetDate = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      } else if (ymd) {
        targetDate = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      } else {
        const parsed = new Date(input);
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed;
        }
      }
    }

    if (isNaN(targetDate.getTime())) {
      return context.reply("Format tanggal tidak valid. Contoh format yang benar: `2026-08-17` atau `17-08-1945`.");
    }

    const dayName = HARI[targetDate.getDay()];
    const pasaran = getPasaranJawa(targetDate);
    const dateNum = targetDate.getDate();
    const monthName = BULAN[targetDate.getMonth()];
    const yearNum = targetDate.getFullYear();
    const hijriah = getKalenderHijriah(targetDate);

    // Cek libur nasional tetap
    const mmdd = `${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
    const libur = LIBUR_NASIONAL_TETAP[mmdd] || (targetDate.getDay() === 0 ? "Hari Minggu (Libur Akhir Pekan)" : null);

    const out = [
      `*KALENDER & WETON SIPIL INDONESIA*`,
      `Masehi   : ${dayName}, ${dateNum} ${monthName} ${yearNum}`,
      `Weton    : *${dayName} ${pasaran}*`,
      `Hijriah  : ${hijriah}`,
      `Status   : ${libur ? `Libur (${libur})` : "Hari Kerja / Aktif"}`,
    ];

    return context.reply(out.join("\n"));
  },
};
