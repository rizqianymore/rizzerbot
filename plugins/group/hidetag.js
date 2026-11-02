import { getGroupContext } from "./_context.js";

export default {
  name: "hidetag",
  groupOnly: true,
  groupAdminOnly: true,
  aliases: ["ht"],
  description: "Mention semua member grup secara senyap/transparan",
  usage: "<pesan>",
  category: "Group",
  cooldownMs: 30000,
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, { requireUserAdmin: true });
    if (!ctx) return;

    const mentions = ctx.participants.map((p) => p.id).slice(0, 256);
    let text = args.join(" ");

    if (!text && context.quoted) {
      text =
        context.quoted.conversation ||
        context.quoted.extendedTextMessage?.text ||
        context.quoted.imageMessage?.caption ||
        context.quoted.videoMessage?.caption ||
        context.quoted.documentMessage?.caption ||
        context.quoted.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        "";
    }

    if (!text) {
      text = "Perhatian semua member!";
    }
    text = String(text).slice(0, 4000);

    try {
      await sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });
    } catch (err) {
      await context.reply(`Gagal hidetag: ${err?.message || err}`);
    }
  },
};
