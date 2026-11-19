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

    const staticQris = settings.qrisPayload || settings.qrisString || "";
    if (!staticQris) {
      return reply(
        "[!] Pengaturan QRIS belum ada.\n" +
          "Isi `qrisPayload` di dalam file `config/settings.js` dengan string QRIS statis Anda."
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

      const caption =
        `┌── QRIS DINAMIS\n` +
        `│ Merchant: ${info.merchantName || settings.qrisMerchantName}\n` +
        `│ Kota: ${info.merchantCity || settings.qrisCity}\n` +
        `│ Nominal: ${formattedNominal}\n` +
        `│ Tipe: Dinamis (Nominal Terkunci Otomatis)\n` +
        `└──\n\n` +
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
