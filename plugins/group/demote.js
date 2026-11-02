import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "demote",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["turunadmin"],
  description: "Menurunkan jabatan admin grup menjadi member biasa",
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
      return context.reply("Balas pesan admin atau masukkan nomor yang ingin dicabut status adminnya!");
    }
    const targetP = ctx.participants.find((p) => db.sameUser(p.id || p, targetJid));
    if (!targetP) return context.reply("Target tidak ada di grup.");
    if (!targetP.admin) return context.reply(`@${targetJid.split("@")[0]} bukan admin.`, { mentions: [targetJid] });
    if (targetP.admin === "superadmin") return context.reply("Tidak bisa demote creator grup.");

    try {
      await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "demote");
      invalidateGroupMeta(ctx.remoteJid, sock);
      await sock.sendMessage(
        ctx.remoteJid,
        {
          text: `Status admin untuk @${targetJid.split("@")[0]} telah dicabut.`,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    } catch (err) {
      await context.reply(`Gagal menurunkan admin: ${err.message}`);
    }
  },
};
