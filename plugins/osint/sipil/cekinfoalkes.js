import { searchInfoAlkes, formatResults } from "@/src/services/osint/infoalkes.js";

const KATEGORI = {
  1: "nomor_izin_edar",
  2: "nama_produk",
  3: "pendaftar",
  4: "tipe",
  5: "produsen",
  6: "jenis_produk",
};

const _KATEGORI_LABEL = {
  nomor_izin_edar: "Nomor Izin Edar",
  nama_produk: "Nama Produk",
  pendaftar: "Pendaftar",
  tipe: "Tipe",
  produsen: "Produsen",
  jenis_produk: "Jenis Produk",
};

export default {
  name: "cekinfoalkes",
  aliases: ["infoalkes", "cekalex", "ceknies", "alkes", "pkrt"],
  description: "Cek data Alkes/PKRT & Izin Edar di infoalkes.kemkes.go.id",
  usage: "<query> [kategori:1-6]",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const rawArgs = (args || []).join(" ").trim();

    if (!rawArgs) {
      return reply(
        `*CEK INFO ALKES / PKRT*\n\n` +
          `Masukkan nomor izin edar, nama produk, pendaftar, tipe, produsen, atau jenis produk.\n\n` +
          `*Format:*\n` +
          `\`${currentPrefix}cekinfoalkes <query> [kategori]\`\n\n` +
          `*Kategori (opsional):*\n` +
          `1. Nomor Izin Edar (default)\n` +
          `2. Nama Produk\n` +
          `3. Pendaftar\n` +
          `4. Tipe\n` +
          `5. Produsen\n` +
          `6. Jenis Produk\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}cekinfoalkes AKL 21603712060\`\n` +
          `• \`${currentPrefix}infoalkes "LITHO Surgical" 2\`\n` +
          `• \`${currentPrefix}cekalex "PT. I-TECH" 3\`\n` +
          `• \`${currentPrefix}ceknies "Surgical Laser" 2\`\n\n` +
          `_Sumber: infoalkes.kemkes.go.id (e-Info Alkes PKRT Kemkes RI)_`
      );
    }

    let query = rawArgs;
    let category = "nomor_izin_edar";
    const parts = rawArgs.split(" ");
    const lastPart = parts[parts.length - 1];
    if (/^[1-6]$/.test(lastPart)) {
      category = KATEGORI[lastPart];
      query = parts.slice(0, -1).join(" ").trim();
    }

    if (query.length < 2) {
      return reply("Query terlalu pendek (minimal 2 karakter).");
    }

    await sendTyping();
    const startTime = Date.now();

    try {
      const result = await searchInfoAlkes(query, category);
      return reply(formatResults(query, result, startTime));
    } catch (err) {
      return reply(`Gagal memeriksa: ${err.message}`);
    }
  },
};
