import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "listadmin",
  groupOnly: true,
  aliases: ["adminlist", "admins"],
  description: "Menampilkan daftar seluruh admin grup saat ini",
  usage: "",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: false,
      requireBotAdmin: false,
    });
    if (!ctx) return;

    const admins = ctx.participants.filter((p) => p.admin);
    if (!admins.length) {
      return context.reply("Tidak ditemukan admin di grup ini.");
    }

    const creator = admins.find((p) => p.admin === "superadmin");
    const regularAdmins = admins.filter((p) => p.admin !== "superadmin");

    let text = `*DAFTAR ADMIN GRUP*\n`;
    text += `*Grup:* ${ctx.meta.subject}\n`;
    text += `*Total Admin:* ${admins.length}\n\n`;

    if (creator) {
      text += `*Creator / Pembuat Grup:*\n• @${creator.id.split("@")[0]}\n\n`;
    }

    if (regularAdmins.length > 0) {
      text += `*Admin:*\n`;
      regularAdmins.forEach((a, i) => {
        text += `${i + 1}. @${a.id.split("@")[0]}\n`;
      });
    }

    const mentions = admins.map((a) => a.id);
    await sock.sendMessage(ctx.remoteJid, { text: text.trim(), mentions }, { quoted: msg });
  },
};
