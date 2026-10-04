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
  "name": "listtrx",
  "aliases": ["riwayattrx","orderlist","daftartrx"],
  "description": "Melihat daftar transaksi orderan terbaru",
  "usage": "[jumlah]",
  "adminOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, isGroup }) => {
      await sendTyping();
      const limit = Number(args[0]) || 10;
      const remoteJid = msg.key.remoteJid;
      const list = listTransactions({ limit, groupJid: isGroup ? remoteJid : null });

      if (list.length === 0) {
        return reply("Belum ada riwayat transaksi yang tersimpan.");
      }

      let text = `*DAFTAR TRANSAKSI TERBARU* (${list.length})\n\n`;
      for (const [i, t] of list.entries()) {
        text +=
          `*${i + 1}.* \`${t.id}\`\n` +
          `• Item: ${t.item} (${t.formattedPrice})\n` +
          `• Pembeli: ${t.buyer}\n` +
          `• Status: ${t.status}\n` +
          `• Waktu: ${t.time}\n\n`;
      }
      text += `_Ketik .cektrx <ID> untuk melihat struk lengkap._`;

      await reply(text);
    },
};
