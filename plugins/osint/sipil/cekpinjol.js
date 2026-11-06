import { checkPinjol } from "@/src/services/osint/pinjol/index.js";

export default {
  name: "cekpinjol",
  aliases: ["pinjol", "cekojik", "ojkpinjol", "pinjollelegal"],
  description: "Cek legalitas platform Pinjaman Online (Pinjol) terdaftar OJK atau Ilegal",
  usage: "<nama platform/aplikasi pinjol>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let query = args.join(" ").trim();
    if (!query && context.quotedText) {
      query = context.quotedText.trim();
    }

    if (!query) {
      return context.reply(
        `*CEK LEGALITAS PINJOL OJK & ILEGAL*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}cekpinjol <nama pinjol/perusahaan>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}cekpinjol AdaKami\n` +
        `• ${context.prefix || "."}cekpinjol Aku Rupiah\n` +
        `• ${context.prefix || "."}cekpinjol Akulaku`
      );
    }

    await context.sendTyping();

    const res = checkPinjol(query);
    if (!res.success) {
      return context.reply(res.message);
    }

    const out = [`*HASIL CEK PINJAMAN ONLINE (OJK)*`];
    out.push(`Pencarian: *${res.query}*\n`);

    if (res.isLegal) {
      out.push(`Status: ✅ *RESMI / TERDAFTAR DI OJK*`);
      out.push(`Ditemukan ${res.totalLegalFound} entitas resmi:\n`);

      res.legal.forEach((item, idx) => {
        out.push(`*${idx + 1}. ${item.platform_name}*`);
        out.push(`• Perusahaan   : ${item.company_name}`);
        out.push(`• No. Izin/Reg : ${item.registration || "-"}`);
        out.push(`• Status OJK   : ${item.registration_type || "Terdaftar/Berizin"}`);
        if (item.website?.length) {
          out.push(`• Website Resmi: ${item.website.join(", ")}`);
        }
        if (item.alamat) {
          out.push(`• Alamat       : ${item.alamat.replace(/\r?\n|\r/g, " ").slice(0, 120)}...`);
        }
        out.push(``);
      });
    } else if (res.isIllegal) {
      out.push(`Status: 🚨 *TERDETEKSI ILEGAL / SATGAS WASPADA INVESTASI*`);
      out.push(`Ditemukan ${res.totalIllegalFound} entitas tidak berizin:\n`);

      res.illegal.forEach((item, idx) => {
        out.push(`*${idx + 1}. ${item.name}*`);
        out.push(`• Developer / Pemilik: ${item.developer}`);
        out.push(``);
      });

      out.push(`⚠️ *Peringatan:* Jangan mengunduh atau melakukan transaksi pinjaman pada aplikasi ini demi keamanan data pribadi & kontak Anda!`);
    } else if (res.isWarning) {
      out.push(`Status: ⚠️ *PERINGATAN (Ditemukan di Daftar Legal & Ilegal)*`);
      out.push(`Ada kemungkinan aplikasi ilegal meniru / mencatut nama platform resmi berizin OJK.`);
      out.push(`\nPastikan hanya mengunduh dari website resmi atau pengembang sah terdaftar OJK.`);
    } else {
      out.push(`Status: ❓ *TIDAK DITEMUKAN DI DAFTAR RESMI OJK*`);
      out.push(`Platform dengan kata kunci "${res.query}" tidak tercatat di data resmi P2P Lending OJK.`);
      out.push(`\n⚠️ *Waspada:* Bila platform tersebut menawarkan pinjaman melalui SMS, WhatsApp, atau link APK luar Play Store/App Store, patut diduga sebagai *PINJOL ILEGAL*.`);
    }

    out.push(`\n*Tips Aman OJK:*`);
    out.push(`• Bunga & biaya harus transparan`);
    out.push(`• Pinjol legal TIDAK meminta akses ke kontak, galeri, atau media ponsel.`);

    return context.reply(out.join("\n"));
  },
};
