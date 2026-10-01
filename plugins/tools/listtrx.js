// plugins/tools/listtrx.js — perintah "listtrx" (1 file = 1 perintah).
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
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, isGroup }) => {
      await sendTyping();
      const limit = Number(args[0]) || 10;
      const remoteJid = msg.key.remoteJid;
      const list = listTransactions({ limit, groupJid: isGroup ? remoteJid : null });

      if (list.length === 0) {
        return reply("📋 Belum ada riwayat transaksi yang tersimpan.");
      }

      let text = `📋 *DAFTAR TRANSAKSI TERBARU* (${list.length})\n`;
      for (const [i, t] of list.entries()) {
        const statusIcon =
          t.status === "LUNAS" ? "✅" : t.status === "PROSES" ? "🔄" : t.status === "BATAL" ? "❌" : "⏳";
        text +=
          `*${i + 1}.* \`${t.id}\`\n` +
          `   🛒 *${t.item}* (${t.formattedPrice})\n` +
          `   👤 ${t.buyer} | ${statusIcon} *${t.status}*\n` +
          `   📅 ${t.time}\n\n`;
      }
      text += `_Ketik .cektrx <ID> untuk melihat struk lengkap._`;

      await reply(text);
    },
};
