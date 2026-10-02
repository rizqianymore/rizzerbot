// plugins/tools/deltrx.js — perintah "deltrx" (1 file = 1 perintah).
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
  "name": "deltrx",
  "aliases": ["hapustrx","canceltrx"],
  "description": "Hapus catatan transaksi dari database",
  "usage": "<id_trx>",
  "adminOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const id = args[0];
      if (!id) {
        return reply("❌ Masukkan ID Transaksi yang ingin dihapus!\n*Contoh:* `.deltrx TRX-20260926-XXXX`");
      }

      const success = deleteTransaction(id);
      if (!success) {
        return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
      }

      await reply(`🗑️ Transaksi *"${id}"* berhasil dihapus dari sistem.`);
    },
};
