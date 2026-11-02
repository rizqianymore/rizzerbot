import { getGroupContext } from "./_context.js";

export default {
  name: "tagall",
  groupOnly: true,
  groupAdminOnly: true,
  aliases: ["totag"],
  description: "Mention semua member grup dengan daftar teks",
  usage: "[pesan]",
  category: "Group",
  cooldownMs: 30000,
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, { requireUserAdmin: true });
    if (!ctx) return;

    const mentions = ctx.participants.map((p) => p.id).slice(0, 256);
    const customMessage = String(args.join(" ") || "Halo semuanya!").slice(0, 500);

    let text = `*Tag All - ${ctx.meta.subject}*\n`;
    text += `*Pesan:* ${customMessage}\n`;
    text += `*Total Member:* ${ctx.participants.length}\n\n`;

    const display = ctx.participants.slice(0, 80);
    display.forEach((p, index) => {
      const num = p.id.split("@")[0];
      const role = p.admin ? (p.admin === "superadmin" ? " (Creator)" : " (Admin)") : "";
      text += `${index + 1}. @${num}${role}\n`;
    });
    if (ctx.participants.length > 80) {
      text += `\n_...dan ${ctx.participants.length - 80} member lainnya_`;
    }
    text = text.slice(0, 4500);

    try {
      await sock.sendMessage(ctx.remoteJid, { text: text.trim(), mentions }, { quoted: msg });
    } catch (err) {
      await context.reply(`Gagal tagall: ${err?.message || err}`);
    }
  },
};
