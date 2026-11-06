import { analyzeWebsite } from "@/src/services/osint/ceksitus/index.js";

export default {
  name: "ceksitus",
  aliases: ["scamcheck", "ceksitusscam", "ceklink", "phishingcheck", "urlcheck"],
  description: "Deteksi keamanan link website, indikasi phising, penipuan, malware APK, dan usia domain",
  usage: "<link/url website>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let input = args[0]?.trim();
    if (!input && context.quotedText) {
      const match = context.quotedText.match(/https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/);
      if (match) input = match[0];
    }

    if (!input) {
      return context.reply(
        `*DETEKTOR LINK SCAM, PHISHING & MALWARE*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}ceksitus <link-atau-domain>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}ceksitus https://undian-berhadiah.xyz\n` +
        `• ${context.prefix || "."}ceksitus tokopedla.site/klaim-dana\n` +
        `• ${context.prefix || "."}ceksitus google.com\n\n` +
        `Tip: Anda juga bisa me-reply pesan teks yang memuat tautan mencurigakan.`
      );
    }

    await context.sendTyping();

    const res = await analyzeWebsite(input);
    if (!res.valid) {
      return context.reply(`Format link salah: ${res.reason}`);
    }

    const out = [`*HASIL ANALISIS KEAMANAN SITUS*`];
    out.push(`Domain       : \`${res.hostname}\``);
    out.push(`Status Risiko: ${res.level}`);
    out.push(`Skor Bahaya  : *${res.riskScore}/100*`);

    if (res.createdDate && res.createdDate !== "-") {
      out.push(`Tanggal Dibuat: ${res.createdDate} (${res.ageDays} hari lalu)`);
    }
    if (res.registrar && res.registrar !== "-") {
      out.push(`Registrar     : ${res.registrar}`);
    }
    if (res.ips?.length > 0) {
      out.push(`Alamat IP     : ${res.ips.slice(0, 3).join(", ")}`);
    }

    if (res.riskFactors.length > 0) {
      out.push(``, `*Indikasi & Faktor Ancaman Terdeteksi:*`);
      for (const rf of res.riskFactors) {
        out.push(`• ⚠️ ${rf}`);
      }
    }

    out.push(``, `💡 *Edukasi Keamanan Siber:*`);
    out.push(`• Jangan pernah memasukkan PIN, kata sandi, atau kode OTP pada tautan tidak resmi.`);
    out.push(`• Bank & layanan resmi tidak pernah membagikan link undian berhadiah melalui nomor WA acak.`);

    return context.reply(out.join("\n"));
  },
};
