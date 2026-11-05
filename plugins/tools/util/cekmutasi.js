import { checkMutasi } from "@/src/services/finance/mutasi.js";

export default {
  name: "cekmutasi",
  aliases: ["mutasi", "ceksaldo", "riwayatbayar"],
  description: "Cek riwayat mutasi pembayaran masuk (Bank & E-Wallet)",
  category: "Tools",
  ownerOnly: true,
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();

    const apiKey = process.env.MUTASI_API_KEY || process.env.ORKUT_API_KEY;
    if (!apiKey) {
      return reply(
        "[!] Layanan mutasi belum aktif.\n\n" +
          "Untuk mengaktifkan fitur konfirmasi mutasi otomatis, tambahkan API Key gateway mutasi di `.env`:\n" +
          "• `MUTASI_API_KEY=...`\n" +
          "• `MUTASI_USERNAME=...` (opsional jika memakai OrderKuota/Orkut)\n\n" +
          "Dukungan gateway: OrderKuota, Cekmutasi, Moyab, atau Webhook gateway transfer lokal."
      );
    }

    try {
      const transactions = await checkMutasi();

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return reply(
          "*RIWAYAT MUTASI TERAKHIR*\n\n" +
            "Belum ada mutasi pembayaran masuk baru yang tercatat dalam sistem."
        );
      }

      const top5 = transactions.slice(0, 5);
      const lines = ["*MUTASI PEMBAYARAN MASUK TERAKHIR*", ""];

      top5.forEach((tx, idx) => {
        const nominal = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
        }).format(Number(tx.amount || tx.nominal || tx.kredit || 0));

        const waktu = tx.timestamp || tx.date || tx.created_at || "Baru saja";
        const sender = tx.sender || tx.keterangan || tx.bank || "QRIS Payment";

        lines.push(`${idx + 1}. *${nominal}*`);
        lines.push(`   • Dari / Info: ${sender}`);
        lines.push(`   • Waktu: ${waktu}`);
        lines.push("");
      });

      await reply(lines.join("\n"));
    } catch (err) {
      await reply(`[FAIL] Gagal memeriksa mutasi: ${err.message}`);
    }
  },
};
