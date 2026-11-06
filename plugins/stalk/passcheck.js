import { checkPasswordLeak } from "@/src/services/osint/passcheck.js";

export default {
  name: "passcheck",
  aliases: ["cekpass", "pwnedpass", "passwordleak", "stalkpass"],
  description: "Cek apakah kata sandi pernah bocor di database data breach (menggunakan model privasi aman k-Anonymity HIBP)",
  usage: "<kata_sandi>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args.join(" ").trim();
    if (!input) {
      return context.reply(
        `*OSINT PASSWORD BREACH INVESTIGATION*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}passcheck <kata-sandi>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}passcheck password123\n` +
        `• ${context.prefix || "."}passcheck admin12345\n\n` +
        `🔒 *Jaminan Keamanan Privasi:* Password Anda TIDAK PERNAH dikirim ke server luar. Pemeriksaan menggunakan algoritma matematis _k-Anonymity SHA-1_ yang 100% aman.`
      );
    }

    await context.sendTyping();

    const res = await checkPasswordLeak(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    const out = [`*HASIL INVESTIGASI KEBOCORAN KATA SANDI*`];
    out.push(`Hash SHA-1 Prefix: \`${res.hashPrefix}\``);

    if (res.leaked) {
      out.push(`Status Keamanan  : 🚨 *SANGAT BERBAHAYA (PERNAH BOCOR)*`);
      out.push(`Total Frekuensi  : Terdeteksi sebanyak *${res.count.toLocaleString("id-ID")} kali* di berbagai kebocoran data internet!`);
      out.push(
        ``,
        `⚠️ *Peringatan Keras:*`,
        `Kata sandi ini sudah masuk dalam kamus _wordlist_ hacker/brute-force tools.`,
        `JANGAN PERNAH gunakan kata sandi ini untuk akun media sosial, perbankan, atau email!`
      );
    } else {
      out.push(`Status Keamanan  : ✅ *AMAN / BELUM PERNAH TEREKSPOS*`);
      out.push(
        ``,
        `Kata sandi ini tidak ditemukan dalam catatan database kebocoran publik HIBP (HaveIBeenPwned).`,
        `Pastikan tetap mengombinasikan huruf besar, angka, dan simbol untuk keamanan maksimal.`
      );
    }

    return context.reply(out.join("\n"));
  },
};
