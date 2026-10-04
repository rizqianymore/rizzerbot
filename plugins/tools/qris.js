import {
  createTransaction,
  getTransaction,
  updateTransaction,
  listTransactions,
  deleteTransaction,
  generateReceiptCard,
  formatTrxText,
  formatRupiah,
} from "@/src/services/trx.js";
import {
  convertQRIS,
  generatePureQR,
  generateQrisCard,
  getActiveQrisString,
  parseQRIS,
  validateQRIS,
} from "@/src/services/qris.js";
import { db } from "@/src/core/database.js";

import { getPrimarySock } from "@/src/core/connection.js";

export default {
  "name": "qris",
  "aliases": ["qrisdinamis","payqris","bayarqris"],
  "description": "Buat kode QRIS Dinamis dengan nominal otomatis atau QRIS Statis",
  "usage": "[nominal / bebas]",
  "adminOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const rawInput = args.join(" ").trim();
      const staticQris = getActiveQrisString();
      const activeSettings = db.getSettings();

      if (!rawInput) {

        try {
          const parsed = parseQRIS(staticQris);
          const qrBuffer = await generatePureQR(staticQris);

          return await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: qrBuffer,
              caption:
                `🏪 *QRIS RESMI TOKO*\n` +
                `🏢 *Merchant:* ${parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud"}\n` +
                `📍 *Kota:* ${parsed.merchantCity || activeSettings.qrisCity || "JAKARTA BARAT"}\n` +
                `💳 *Tipe:* QRIS Statis (Nominal Bebas)\n\n` +
                `💡 _Ingin nominal otomatis? Ketik: \`${prefix}qris <nominal>\` (Contoh: \`${prefix}qris 25000\`)_`,
            },
            { quoted: msg }
          );
        } catch (err) {
          return reply(`❌ Gagal membuat QRIS: ${err.message}`);
        }
      }

      let cleanInput = rawInput.toLowerCase().replace(/^rp\.?/, "").trim();
      if (cleanInput.endsWith("k")) cleanInput = String(parseFloat(cleanInput) * 1000);
      const amount = Number(cleanInput.replace(/[^0-9.]/g, ""));

      if (!amount || isNaN(amount) || amount <= 0) {
        return reply(`❌ Masukkan nominal yang valid!\n*Contoh:* \`${prefix}qris 15000\` atau \`${prefix}qris 25k\``);
      }

      try {
        const dynamicPayload = convertQRIS(staticQris, { amount });
        const parsed = parseQRIS(dynamicPayload);
        const qrBuffer = await generatePureQR(dynamicPayload);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: qrBuffer,
            caption:
              `⚡ *QRIS DINAMIS SIAP BAYAR*\n` +
              `🏢 *Merchant:* ${parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud"}\n` +
              `📍 *Kota:* ${parsed.merchantCity || activeSettings.qrisCity || "JAKARTA BARAT"}\n` +
              `💰 *Total Nominal:* *${formatRupiah(amount)}*\n` +
              `⏱️ *Kedaluwarsa:* 15 Menit\n\n` +
              `_Scan langsung dengan DANA, BCA, GoPay, OVO, ShopeePay, atau m-Banking Anda. Nominal otomatis terisi pas!_`,
          },
          { quoted: msg }
        );
      } catch (err) {
        reply(`❌ Gagal memproses QRIS Dinamis: ${err.message}`);
      }
    },
};
