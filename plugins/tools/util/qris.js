import { convertQRIS, parseQRISInfo, createQrisBuffer } from "@/src/services/finance/qris.js";
import { settings } from "@/config/settings.js";

export default {
  name: "qris",
  aliases: ["dynamicqris", "buatqris", "payqris"],
  description: "Membuat QRIS dinamis otomatis sesuai nominal pembayaran",
  usage: "<nominal>",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const rawAmount = (args[0] || "").replace(/[^0-9]/g, "");

    if (!rawAmount || Number(rawAmount) <= 0) {
      return reply(
        "*QRIS DINAMIS*\n\n" +
          "Format: `.qris <nominal>`\n" +
          "Contoh: `.qris 50000`\n\n" +
          "Fitur ini mengubah QRIS statis menjadi QRIS dinamis berbasis EMVCo TLV sehingga nominal pembayaran otomatis terkunci dan pembeli tidak salah transfer."
      );
    }

    const staticQris = process.env.QRIS_PAYLOAD || settings.qrisPayload || settings.qrisString || "";
    if (!staticQris) {
      return reply(
        "[!] Pengaturan QRIS belum ada.\n" + "Isi `QRIS_PAYLOAD` di dalam file `.env` dengan string QRIS statis Anda."
      );
    }

    try {
      const amount = Number(rawAmount);
      const dynamicPayload = convertQRIS(staticQris, { amount });
      const info = parseQRISInfo(staticQris);
      const qrBuffer = await createQrisBuffer(dynamicPayload);

      const formattedNominal = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount);

      const mName = process.env.QRIS_MERCHANT_NAME || info.merchantName || settings.qrisMerchantName || "Merchant";
      const mCity = process.env.QRIS_CITY || info.merchantCity || settings.qrisCity || "Indonesia";

      const caption =
        `┌── QRIS DINAMIS\n` +
        `│ Merchant: ${mName}\n` +
        `│ Kota: ${mCity}\n` +
        `│ Nominal: ${formattedNominal}\n` +
        `│ Tipe: Dinamis (Nominal Terkunci Otomatis)\n` +
        `└─\n\n` +
        `Dukungan: BCA, Mandiri, BRI, BNI, Dana, GoPay, OVO, ShopeePay, LinkAja, dll.\n` +
        `Silakan scan barcode QRIS di atas untuk menyelesaikan pembayaran tepat.`;

      const jid = msg.key.remoteJid;
      await sock.sendMessage(
        jid,
        {
          image: qrBuffer,
          caption,
        },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`[FAIL] Gagal membuat QRIS dinamis: ${err.message}`);
    }
  },
};
