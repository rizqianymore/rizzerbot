// plugins/tools/setqris.js — perintah "setqris" (1 file = 1 perintah).
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
  "name": "setqris",
  "aliases": ["updateqris"],
  "description": "Atur string QRIS statis utama bot (Khusus Owner)",
  "usage": "<string qris>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const newString = args.join(" ").trim();
      if (!newString) {
        const cur = getActiveQrisString();
        const parsed = parseQRIS(cur);
        return reply(
          `📱 *PENGATURAN QRIS TOKO*\n\n` +
          `• *Merchant:* ${parsed.merchantName || "-"}\n` +
          `• *Kota:* ${parsed.merchantCity || "-"}\n` +
          `• *String Aktif:* \`${cur}\`\n\n` +
          `*Cara Mengganti:*\n` +
          `• \`.setqris <string_qris_baru>\``
        );
      }

      const validation = validateQRIS(newString);
      if (!validation.valid) {
        return reply(
          `❌ Format string QRIS tidak valid!\n` +
          `Alasan:\n- ` +
          validation.errors.join("\n- ")
        );
      }

      const parsed = parseQRIS(newString);
      db.updateSettings({
        qrisString: newString,
        qrisMerchantName: parsed.merchantName || "Rizzer Cloud",
        qrisCity: parsed.merchantCity || "JAKARTA BARAT",
      });

      reply(
        `✅ *QRIS Berhasil Diperbarui!*\n\n` +
        `🏢 *Merchant:* ${parsed.merchantName}\n` +
        `📍 *Kota:* ${parsed.merchantCity}\n` +
        `🔐 *CRC16:* ${parsed.crc} (Valid)\n` +
        `⚡ Semua pembayaran otomatis akan menggunakan QRIS ini.`
      );
    },
};
