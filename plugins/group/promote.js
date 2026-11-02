import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "promote",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["naikadmin"],
  description: "Menaikkan member menjadi admin grup",
  usage: "@user",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    const targetJid = context.getTargetJid(args);
    if (!targetJid) {
      return context.reply("Balas pesan member atau masukkan nomor yang ingin dinaikkan jadi admin!");
    }
    const targetP = ctx.participants.find((p) => db.sameUser(p.id || p, targetJid));
    if (!targetP) return context.reply("Target tidak ada di grup.");
    if (targetP.admin === "admin" || targetP.admin === "superadmin") {
      return context.reply(`@${targetJid.split("@")[0]} sudah admin.`, { mentions: [targetJid] });
    }

    try {
      await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "promote");
      invalidateGroupMeta(ctx.remoteJid, sock);
      await sock.sendMessage(
        ctx.remoteJid,
        {
          text: `Selamat! @${targetJid.split("@")[0]} sekarang telah menjadi Admin grup.`,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    } catch (err) {
      await context.reply(`Gagal menaikkan admin: ${err.message}`);
    }
  },
};
