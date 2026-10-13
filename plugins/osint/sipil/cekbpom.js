import { searchProduk, formatResults } from "@/src/services/osint/bpom.js";

export default {
  name: "cekbpom",
  aliases: ["bpom", "cekproduk", "ceknie", "cekizin"],
  description: "Cek izin edar produk BPOM (Obat, Kosmetik, Makanan, Suplemen, dll)",
  usage: "<nama produk / merk / nomor registrasi / NIE / pendaftar>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = (args || []).join(" ").trim();

    if (!query) {
      return reply(
        `🔍 *CEK IZIN EDAR BPOM*\n\n` +
          `Masukkan nama produk, merk, nomor registrasi, NIE, atau nama pendaftar.\n\n` +
          `*Contoh:*\n` +
          `• \`${currentPrefix}cekbpom Paracetamol\`\n` +
          `• \`${currentPrefix}bpom Wardah\`\n` +
          `• \`${currentPrefix}cekproduk ML-123456789\`\n` +
          `• \`${currentPrefix}ceknie PT Kimia Farma\`\n\n` +
          `_Data: cekbpom.pom.go.id (Produk Teregistrasi yang masih berlaku)_`
      );
    }

    if (query.length < 2) {
      return reply("❌ Query terlalu pendek (minimal 2 karakter).");
    }

    await sendTyping();
    const startTime = Date.now();

    try {
      const results = await searchProduk(query);
      return reply(formatResults(query, results, startTime));
    } catch (err) {
      return reply(`❌ Gagal memeriksa: ${err.message}`);
    }
  },
};
