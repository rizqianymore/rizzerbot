import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "setdesc",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["setdeskripsi", "descgc"],
  description: "Mengubah deskripsi grup",
  usage: "<deskripsi baru>",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    const newDesc = args.join(" ").trim();
    if (!newDesc) {
      return context.reply(
        "Masukkan deskripsi baru untuk grup! Contoh: *.setdesc Grup diskusi seputar teknologi & bot WhatsApp*"
      );
    }

    try {
      await sock.groupUpdateDescription(ctx.remoteJid, newDesc);
      invalidateGroupMeta(ctx.remoteJid);
      await context.reply("Deskripsi grup berhasil diperbarui!");
    } catch (err) {
      await context.reply(`Gagal mengubah deskripsi grup: ${err.message}`);
    }
  },
};
