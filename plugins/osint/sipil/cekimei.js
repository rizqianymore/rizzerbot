import { parseImei, scrapeImeiOnline } from "@/src/services/osint/imei.js";
import { isBrightDataEnabled } from "@/src/services/network/brightdata.js";

export default {
  name: "imei",
  aliases: ["cekimei", "imeilookup", "taclookup"],
  description: "Forensik & OSINT validasi IMEI perangkat HP (Luhn check, TAC, Manufaktur GSMA)",
  usage: "<15 digit IMEI>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let input = args.join(" ").trim();
    if (!input && context.quotedText) {
      input = context.quotedText;
    }

    if (!input) {
      return context.reply(
        `*OSINT & FORENSIK IMEI LOOKUP*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}imei <15-digit-imei>\n\n` +
        `*Contoh:*\n` +
        `${context.prefix || "."}imei 353014061234567\n\n` +
        `Tip: Anda juga bisa me-reply pesan teks yang berisi nomor IMEI.`
      );
    }

    await context.sendTyping();

    let result;
    if (isBrightDataEnabled()) {
      result = await scrapeImeiOnline(input);
    } else {
      result = parseImei(input);
    }

    if (!result.valid) {
      return context.reply(`Format IMEI tidak valid: ${result.reason}`);
    }

    let luhnStatus = "-";
    if (result.luhnValid === true) {
      luhnStatus = `Valid (Checksum Cocok: ${result.checkDigit})`;
    } else if (result.luhnValid === false) {
      luhnStatus = `INVALID (Actual: ${result.checkDigit}, Seharusnya: ${result.expectedCheckDigit}) — Kemungkinan IMEI Palsu/Kloning!`;
    }

    const out = [
      `*HASIL ANALISIS FORENSIK IMEI*`,
      `IMEI          : \`${result.imei}\``,
      `Format GSMA   : ${result.imeiFormatted}`,
      `Status Luhn   : ${luhnStatus}`,
      ``,
      `*Informasi Alokasi Hardware (TAC):*`,
      `• TAC Code    : ${result.tac}`,
      `• Asal Badan  : ${result.reportingBody}`,
      `• Merek       : ${result.brand}`,
      `• Model / Seri: ${result.model}`,
      `• Serial Number: ${result.serialNumber}`,
    ];

    if (result.scraped && result.details && Object.keys(result.details).length > 0) {
      out.push(``, `*Spesifikasi & Live Data (${result.scrapeSource}):*`);
      const topKeys = Object.keys(result.details).slice(0, 10);
      for (const k of topKeys) {
        out.push(`• ${k}: ${result.details[k]}`);
      }
    }

    out.push(
      ``,
      `*Pengecekan Legalitas Kemenperin / Bea Cukai RI:*`,
      `• Bea Cukai   : ${result.beacukaiCheckUrl}`,
      `• Kemenperin  : ${result.kemenperinCheckUrl}`
    );

    return context.reply(out.join("\n"));
  },
};
