// plugins/owner/cekplat.js — Lookup database plat nomor SAMSAT (Khusus SuperOwner Bot Utama).
import { searchByPlate, searchByNik, isSamsatReady } from '@/src/services/samsatService.js';

export default {
  name: "cekplat",
  aliases: ["plat", "samsat", "ceknopol", "ceknikplat"],
  description: "Cek data kepemilikan kendaraan & SAMSAT (Khusus SuperOwner Bot Utama)",
  usage: "<plat nomor / NIK>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
    if (!isPrimarySuperOwner) {
      return reply("Perintah ini hanya dapat diakses oleh SuperOwner Bot Utama.");
    }

    if (!args.length) {
      return reply(
        "*FORMAT PENGGUNAAN*\n\n" +
        "• Plat : .cekplat KT5207ZF (atau .cekplat B 1234 ABC)\n" +
        "• NIK  : .cekplat 6471052005720007"
      );
    }

    if (!isSamsatReady()) {
      return reply("Database SAMSAT (database/samsat.db) belum tersedia di server.");
    }

    await sendTyping();

    const input = args.join("").trim();
    const isNik = /^\d{16}$/.test(input);
    const startTime = performance.now();

    try {
      if (isNik) {
        const list = searchByNik(input);
        const latency = (performance.now() - startTime).toFixed(2);

        if (!list || list.length === 0) {
          return reply(`Data kendaraan dengan NIK ${input} tidak ditemukan (${latency} ms).`);
        }

        let text = `*DATA KENDARAAN (NIK)*\n\n`;
        text += `• NIK: ${input}\n`;
        text += `• Total: ${list.length} Kendaraan\n\n`;

        list.forEach((item, idx) => {
          text += `[${idx + 1}] ${item.number}\n`;
          text += `• Pemilik: ${item.name || '-'}\n`;
          text += `• Tipe: ${[item.brand, item.type].filter(Boolean).join(' ') || '-'}\n`;
          text += `• Rangka: ${item.vin || '-'}\n`;
          text += `• Mesin: ${item.engine || '-'}\n`;
          text += `• BPKB: ${item.bpkb || '-'}\n`;
          if (item.address) text += `• Alamat: ${item.address}\n`;
          text += `\n`;
        });

        text += `Query: ${latency} ms`;
        return reply(text.trim());
      }

      const data = searchByPlate(input);
      const latency = (performance.now() - startTime).toFixed(2);

      if (!data) {
        const cleanInput = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return reply(`Data kendaraan plat ${cleanInput} tidak ditemukan (${latency} ms).`);
      }

      const text =
        `*DATA KENDARAAN (SAMSAT)*\n\n` +
        `• Plat: ${data.number}\n` +
        `• Nama: ${data.name || '-'}\n` +
        `• NIK: ${data.nik || '-'}\n` +
        `• Alamat: ${data.address || '-'}\n` +
        `• Merk: ${data.brand || '-'}\n` +
        `• Tipe: ${data.type || '-'}\n` +
        `• Rangka: ${data.vin || '-'}\n` +
        `• Mesin: ${data.engine || '-'}\n` +
        `• BPKB: ${data.bpkb || '-'}\n` +
        `• Warna/Tahun: ${data.color || '-'} / ${data.year || '-'}\n\n` +
        `Query: ${latency} ms`;

      return reply(text);
    } catch (err) {
      return reply(`Terjadi kesalahan: ${err.message}`);
    }
  },
};
