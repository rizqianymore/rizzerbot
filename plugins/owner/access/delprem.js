import { db } from "@/src/core/database.js";

export default {
  name: "delprem",
  description: "Hapus pengguna premium",
  usage: "<nomor>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, getTargetJid, senderJid }) => {
    const jid = getTargetJid(args);
    if (!jid) return reply("Balas pesan user atau masukkan nomor! Contoh: *.delprem 628xx*");
    const isOwner = db.isOwner(jid);
    const isAdmin = db.isAdmin(jid);

    db.setPremium(jid, false, null, senderJid);
    if (isOwner) {
      return reply(
        `Owner tidak dapat kehilangan akses Premium.\n` +
        `Berhasil menghapus *${jid.split("@")[0]}* dari daftar Premium.`
      );
    }
    if (isAdmin) {
      return reply(
        `Admin Bot otomatis memiliki akses Premium.\n` +
        `Berhasil menghapus *${jid.split("@")[0]}* dari daftar Premium.`
      );
    }
    if (db.isPremium(jid)) {
      return reply(
        `Status Premium *${jid.split("@")[0]}* belum bisa dicabut (masih terdaftar di sumber konfigurasi).\n` +
          `Periksa *config/settings.js* lalu restart bot.`
      );
    }
    reply(`Berhasil menghapus *${jid.split("@")[0]}* dari daftar Premium.`);
  },
};
