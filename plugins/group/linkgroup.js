import { getGroupContext } from "./_context.js";

export default {
  name: "linkgroup",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["linkgc", "linkgrup"],
  description: "Mengambil link undangan grup WhatsApp",
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
      const code = await sock.groupInviteCode(ctx.remoteJid);
      const link = `https://chat.whatsapp.com/${code}`;
      await context.reply(`*Link Undangan Grup ${ctx.meta.subject}:*\n${link}`);
    } catch (err) {
      await context.reply(`Gagal mengambil link grup: ${err.message}`);
    }
  },
};
