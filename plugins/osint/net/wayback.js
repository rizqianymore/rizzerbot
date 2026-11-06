import { lookupWayback } from "@/src/services/osint/wayback.js";

export default {
  name: "wayback",
  aliases: ["webarchive", "arsipweb", "waybackmachine", "webhistory"],
  description: "Investigasi jejak digital dan rekaman arsip historis halaman web/situs yang sudah terhapus atau berubah",
  usage: "<url / domain>",
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
        `*OSINT FORENSIK DIGITAL WAYBACK MACHINE*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}wayback <domain / tautan-web>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}wayback detik.com\n` +
        `• ${context.prefix || "."}wayback kpu.go.id\n` +
        `• ${context.prefix || "."}wayback https://target-scam.com/promo\n\n` +
        `Fitur ini digunakan untuk membongkar riwayat tampilan situs di masa lalu atau membuka artikel/postingan yang sengaja dihapus pemiliknya.`
      );
    }

    await context.sendTyping();

    const res = await lookupWayback(input);
    if (!res.valid) {
      return context.reply(`Format salah: ${res.reason}`);
    }

    if (!res.found) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INVESTIGASI ARSIP DIGITAL (WAYBACK)*`,
      `Target URL   : \`${res.target}\``,
      ``,
      `*Jejak Arsip Tertua (Pertama Kali Terekam):*`,
      `• Tanggal    : 📅 ${res.firstArchivedDate}`,
      `• Snapshot   : 🔗 ${res.firstArchivedUrl}`,
      ``,
      `*Jejak Arsip Terakhir:*`,
      `• Tanggal    : 📅 ${res.latestArchivedDate}`,
      `• Snapshot   : 🔗 ${res.latestArchivedUrl}`,
      ``,
      `*Kalender Riwayat Lengkap (Semua Snapshot):*`,
      `👉 ${res.calendarUrl}`
    ];

    return context.reply(out.join("\n"));
  },
};
