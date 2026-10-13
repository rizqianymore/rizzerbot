import { deleteTransaction } from "@/src/services/finance/trx.js";

export default {
  name: "deltrx",
  aliases: ["hapustrx", "canceltrx"],
  description: "Hapus catatan transaksi dari database",
  usage: "<id_trx>",
  adminOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping }) => {
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
