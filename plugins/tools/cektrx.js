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
  "name": "cektrx",
  "aliases": ["cekorder","detailtrx","invoicetrx"],
  "description": "Cek detail struk transaksi berdasarkan ID Transaksi",
  "usage": "<id_trx>",
  "adminOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const id = args[0];
      if (!id) {
        return reply("❌ Masukkan ID Transaksi yang ingin dicek!\n*Contoh:* `.cektrx TRX-20260926-XXXX`");
      }

      const trx = getTransaction(id);
      if (!trx) {
        return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
      }

      const caption = formatTrxText(trx);
      const remoteJid = msg.key.remoteJid;

      try {
        const cardBuffer = await generateReceiptCard(trx);
        await sock.sendMessage(
          remoteJid,
          {
            image: cardBuffer,
            caption,
            mentions: trx.buyerJid ? [trx.buyerJid] : [],
          },
          { quoted: msg }
        );
      } catch (_) {
        await reply(caption);
      }
    },
};
