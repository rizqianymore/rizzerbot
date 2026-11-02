import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "revoke",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["resetlink", "revokelink"],
  description: "Mereset link undangan grup dan membuat link baru",
  usage: "",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    try {
      const newCode = await sock.groupRevokeInvite(ctx.remoteJid);
      const newLink = `https://chat.whatsapp.com/${newCode}`;
      await context.reply(`*LINK UNDANGAN GRUP TELAH DI-RESET*\n\nTautan baru:\n${newLink}`);
    } catch (err) {
      await context.reply(`Gagal mereset link grup: ${err.message}`);
    }
  },
};
