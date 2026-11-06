import { checkEmailBreach } from "@/src/services/osint/leakcheck/index.js";

export default {
  name: "leakcheck",
  aliases: ["pwned", "cekbocor", "breachcheck", "leaked"],
  description: "Cek riwayat kebocoran data (data breach) email di internet",
  usage: "<email address>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let email = args[0]?.trim();
    if (!email && context.quotedText) {
      const match = context.quotedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match) email = match[0];
    }

    if (!email) {
      return context.reply(
        `*OSINT DATA BREACH & LEAK CHECK*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}leakcheck <alamat-email>\n\n` +
        `*Contoh:*\n` +
        `${context.prefix || "."}leakcheck target@gmail.com\n\n` +
        `Fitur ini memeriksa apakah email Anda pernah terekspos di database kebocoran data publik (e-commerce, game, platform sosial).`
      );
    }

    await context.sendTyping();

    const result = await checkEmailBreach(email);
    if (!result.valid) {
      return context.reply(`Format email salah: ${result.reason}`);
    }

    const out = [`*HASIL CEK KEBOCORAN DATA EMAIL*`];
    out.push(`Target Email : \`${result.email}\``);

    if (result.breached) {
      out.push(`Status       : 🚨 *TERDETEKSI BOCOR (EXPOSED)*`);
      out.push(`Total Breach : *${result.totalBreaches} Insiden Kebocoran*\n`);
      out.push(`*Daftar Database / Platform Terdampak:*`);

      const displayList = result.breaches.slice(0, 15);
      for (const site of displayList) {
        out.push(`• ${site}`);
      }

      if (result.breaches.length > 15) {
        out.push(`• ...dan ${result.breaches.length - 15} insiden kebocoran lainnya.`);
      }

      out.push(
        ``,
        `⚠️ *Tindakan yang Harus Dilakukan:*`,
        `1. Segera ganti password akun email ini.`,
        `2. Aktifkan Verifikasi 2 Langkah (2FA / OTP).`,
        `3. Ganti password di platform lain jika Anda menggunakan password yang sama!`
      );
    } else {
      out.push(`Status       : ✅ *AMAN / TIDAK DITEMUKAN*`);
      out.push(``);
      out.push(`Email \`${result.email}\` tidak ditemukan dalam riwayat database kebocoran data publik yang tercatat.`);
      out.push(`Tetap jaga keamanan dengan tidak membagikan password & rutin mengganti sandi.`);
    }

    return context.reply(out.join("\n"));
  },
};
