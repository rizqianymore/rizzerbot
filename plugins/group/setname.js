import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "setname",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["setsubject", "namagc"],
  description: "Mengubah nama atau subjek grup",
  usage: "<nama baru>",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    const newName = args.join(" ").trim();
    if (!newName) {
      return context.reply("Masukkan nama baru untuk grup! Contoh: *.setname Rizzer Community*");
    }
    if (newName.length > 100) {
      return context.reply("Nama grup maksimal 100 karakter!");
    }

    try {
      await sock.groupUpdateSubject(ctx.remoteJid, newName);
      invalidateGroupMeta(ctx.remoteJid);
      await context.reply(`Nama grup berhasil diubah menjadi: *${newName}*`);
    } catch (err) {
      await context.reply(`Gagal mengubah nama grup: ${err.message}`);
    }
  },
};
