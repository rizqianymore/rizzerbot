import { db } from "@/src/core/database.js";

export default {
  name: "resetdb",
  description: "Reset database ke kondisi awal (hapus semua data)",
  usage: "--confirm",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply }) => {
    const confirm = args?.[0];
    if (confirm !== "--confirm") {
      return reply("⚠️ Perintah reset database!\nGunakan: `.resetdb --confirm` untuk memulai");
    }
    await reply("⚠️ Segera menghapus semua data database...\nKetik `.resetdb --confirm` sekali lagi untuk konfirmasi");
  },
};
