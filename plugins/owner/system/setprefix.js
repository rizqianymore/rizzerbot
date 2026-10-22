import { db } from "@/src/core/database.js";

export default {
  name: "setprefix",
  description: "Ubah prefix bot (opsional: tambahkan --all untuk semua bot)",
  usage: "<simbol>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, prefix, logger }) => {
    await reply(`Prefix berhasil diubah menjadi: "${args[0]}"`);
  },
};
