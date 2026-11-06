import { trackResi, COURIERS } from "@/src/services/osint/resi/index.js";

export default {
  name: "cekresi",
  aliases: ["resi", "lacakresi", "trackingresi", "lacakpaket"],
  description: "Lacak riwayat pengiriman paket & nomor resi ekspedisi (JNE, J&T, SiCepat, SPX, Anteraja, Pos, Lion Parcel, TIKI)",
  usage: "<nomor_resi> [kurir]",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let input = args.join(" ").trim();
    if (!input && context.quotedText) {
      input = context.quotedText.trim();
    }

    if (!input) {
      const courierList = Object.keys(COURIERS).map((k) => COURIERS[k].name).join(", ");
      return context.reply(
        `*PELACAKAN NOMOR RESI PENGIRIMAN PAKET*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}cekresi <nomor-resi> [kurir]\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}cekresi SPXID04819284192\n` +
        `• ${context.prefix || "."}cekresi 004123456789 sicepat\n` +
        `• ${context.prefix || "."}cekresi JP1234567890 jnt\n\n` +
        `*Daftar Ekspedisi Didukung:*\n${courierList}\n\n` +
        `_Tip: Anda tidak wajib menuliskan nama kurir bila nomor resi memiliki kode awalan resmi (seperti SPXID, JP, dsb)._`
      );
    }

    await context.sendTyping();

    const parts = input.split(/\s+/);
    let resi = parts[0];
    let courier = parts.slice(1).join(" ");

    // Bila argumen pertama nama kurir dan kedua no resi
    if (parts.length >= 2 && COURIERS[parts[0].toLowerCase()]) {
      courier = parts[0];
      resi = parts[1];
    }

    const res = await trackResi(resi, courier);
    if (!res.valid) {
      return context.reply(`Format salah: ${res.reason}`);
    }

    const out = [`*HASIL LACAK NOMOR RESI*`];
    out.push(`No. Resi    : \`${res.awb}\``);
    out.push(`Ekspedisi   : *${res.courier}*`);
    out.push(`Status Paket: *${res.status}*`);

    if (res.history?.length > 0) {
      out.push(``, `*Riwayat Perjalanan Terkini:*`);
      for (const h of res.history) {
        out.push(`• [${h.date}] ${h.desc}`);
      }
    }

    out.push(
      ``,
      `*Tautan Tracking Resmi:*`,
      `👉 ${res.directTrackUrl}`
    );

    return context.reply(out.join("\n"));
  },
};
