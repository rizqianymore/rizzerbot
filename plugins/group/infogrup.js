import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "infogrup",
  groupOnly: true,
  aliases: ["gcinfo", "groupinfo"],
  description: "Menampilkan informasi detail grup WhatsApp saat ini",
  usage: "",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: false,
      requireBotAdmin: false,
    });
    if (!ctx) return;

    const meta = ctx.meta;
    const totalMembers = ctx.participants.length;
    const adminCount = ctx.participants.filter((p) => p.admin).length;
    const creator = meta.owner ? `@${meta.owner.split("@")[0]}` : "-";
    const creationDate = meta.creation
      ? new Date(meta.creation * 1000).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

    let text = `*INFORMASI GRUP*\n\n`;
    text += `*Nama Grup:* ${meta.subject}\n`;
    text += `*ID Grup:* ${meta.id}\n`;
    text += `*Pembuat Grup:* ${creator}\n`;
    text += `*Dibuat Pada:* ${creationDate}\n`;
    text += `*Total Member:* ${totalMembers}\n`;
    text += `*Jumlah Admin:* ${adminCount}\n`;
    text += `*Izin Kirim Pesan:* ${meta.announce ? "Hanya Admin" : "Semua Member"}\n`;
    text += `*Izin Edit Info:* ${meta.restrict ? "Hanya Admin" : "Semua Member"}\n\n`;
    text += `*Deskripsi Grup:*\n${meta.desc || "(Tidak ada deskripsi)"}`;

    const mentions = meta.owner ? [meta.owner] : [];

    try {
      const ppUrl = await sock.profilePictureUrl(ctx.remoteJid, "image").catch(() => null);
      if (ppUrl) {
        await sock.sendMessage(ctx.remoteJid, { image: { url: ppUrl }, caption: text, mentions }, { quoted: msg });
        return;
      }
    } catch (_) {}

    await sock.sendMessage(ctx.remoteJid, { text, mentions }, { quoted: msg });
  },
};
