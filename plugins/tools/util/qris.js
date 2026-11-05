import fs from "fs";
import path from "path";
import { convertQRIS, parseQRISInfo, createQrisBuffer } from "@/src/services/finance/qris.js";
import { settings } from "@/config/settings.js";

function getStaticQris() {
  const configPath = path.join(process.cwd(), "config", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const conf = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (conf.qrisPayload) return conf.qrisPayload;
    } catch (_) {}
  }
  return settings.qrisString || "";
}

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

    const staticQris = getStaticQris();
    if (!staticQris) {
      return reply(
        "[!] Pengaturan QRIS belum ada.\n" +
          "Isi `qrisPayload` di dalam file `config/config.json` dengan string QRIS statis Anda."
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
        "*QRIS PEMBAYARAN DINAMIS*\n\n" +
        `• Merchant: *${info.merchantName}*\n` +
        `• Kota: ${info.merchantCity}\n` +
        `• Nominal: *${formattedNominal}*\n` +
        `• Tipe: Dinamis (Nominal Terkunci Otomatis)\n` +
        `• Dukungan: BCA, Mandiri, BRI, BNI, Dana, GoPay, OVO, ShopeePay, LinkAja, dll.\n\n` +
        "Silakan scan QR code di atas menggunakan aplikasi M-Banking atau E-Wallet apa saja. Nominal pembayaran otomatis terkunci pas tanpa perlu diketik manual.\n\n" +
        "_Catatan: Harap periksa nama merchant sebelum mengonfirmasi pembayaran._";

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
