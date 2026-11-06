import { checkRekening } from "@/src/services/osint/cekrekening/index.js";

export default {
  name: "cekrekening",
  aliases: ["ceknorek", "rekening", "penipu", "cektipu"],
  description: "Cek nomor rekening bank atau e-wallet apakah pernah dilaporkan penipuan",
  usage: "<nomor_rekening> [nama_bank/wallet]",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    let raw = args.join(" ").trim();
    if (!raw && context.quotedText) {
      raw = context.quotedText.trim();
    }

    if (!raw) {
      return context.reply(
        `*CEK NOMOR REKENING / E-WALLET PENIPU*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}cekrekening <nomor-rekening> [bank/wallet]\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}cekrekening 1234567890 BCA\n` +
        `• ${context.prefix || "."}cekrekening 08123456789 DANA\n` +
        `• ${context.prefix || "."}cekrekening 539241249`
      );
    }

    await context.sendTyping();

    const parts = raw.split(/\s+/);
    const account = parts[0];
    const bank = parts.slice(1).join(" ");

    const res = await checkRekening(account, bank);
    if (!res.valid) {
      return context.reply(`Format salah: ${res.reason}`);
    }

    const out = [`*HASIL CEK REKENING & FRAUD DETECTOR*`];
    out.push(`No. Rekening : \`${res.account}\``);
    out.push(`Bank / Wallet: ${res.bank}`);
    out.push(`Status Laporan: ${res.status}`);

    if (res.reports > 0) {
      out.push(`Jumlah Aduan : *${res.reports} Laporan Terdaftar*`);
    }

    out.push(
      ``,
      `*Link Investigasi & Pelaporan Resmi:*`,
      `• Kredibel.com   : ${res.kredibelUrl}`,
      `• Kemkomdigi RI  : ${res.cekrekeningUrl}`,
      ``,
      `⚠️ *Tips Aman Bertransaksi:*`,
      `• Jangan tergiur harga yang jauh di bawah pasar`,
      `• Gunakan fitur rekening bersama / rekber / marketplace terpercaya.`
    );

    return context.reply(out.join("\n"));
  },
};
