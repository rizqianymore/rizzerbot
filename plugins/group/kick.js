import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "kick",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["tendang", "remove"],
  description: "Mengeluarkan member dari grup",
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
      return context.reply(
        "Balas pesan member yang ingin di-kick atau ketik nomornya! Contoh: *.kick @user* atau *.kick 628xxx*"
      );
    }

    const botJid = db.normalizeJid(sock.user?.id);
    if (db.normalizeJid(targetJid) === botJid) {
      return context.reply("Bot tidak bisa meng-kick diri sendiri!");
    }
    if (db.isOwner(targetJid)) {
      return context.reply("Tidak dapat mengeluarkan Owner Bot dari grup!");
    }
    const targetP = ctx.participants.find((p) => db.sameUser(p.id || p, targetJid));
    if (!targetP) {
      return context.reply("Target tidak ada di grup ini.");
    }
    if (targetP.admin === "superadmin") {
      return context.reply("Tidak bisa kick creator grup.");
    }

    try {
      await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "remove");
      invalidateGroupMeta(ctx.remoteJid, sock);
      await sock.sendMessage(
        ctx.remoteJid,
        {
          text: `Berhasil mengeluarkan @${targetJid.split("@")[0]} dari grup.`,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    } catch (err) {
      await context.reply(`Gagal mengeluarkan member: ${err.message}`);
    }
  },
};
