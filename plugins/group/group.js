import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";

export default {
  name: "group",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["grup"],
  description: "Buka atau tutup grup (chatting semua member / hanya admin)",
  usage: "<open / close>",
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    const action = (args[0] || "").toLowerCase();
    const isAnnounce = Boolean(ctx.meta.announce);
    try {
      if (action === "open" || action === "buka") {
        if (!isAnnounce) return context.reply("Grup sudah dalam keadaan terbuka.");
        await sock.groupSettingUpdate(ctx.remoteJid, "not_announcement");
        invalidateGroupMeta(ctx.remoteJid, sock);
        await context.reply("*GRUP BERHASIL DIBUKA!* Semua member sekarang dapat mengirim pesan.");
      } else if (action === "close" || action === "tutup") {
        if (isAnnounce) return context.reply("Grup sudah dalam keadaan tertutup.");
        await sock.groupSettingUpdate(ctx.remoteJid, "announcement");
        invalidateGroupMeta(ctx.remoteJid, sock);
        await context.reply("*GRUP BERHASIL DITUTUP!* Hanya admin yang dapat mengirim pesan.");
      } else {
        await context.reply(
          "Perintah tidak valid! Gunakan: *.group open* (buka grup) atau *.group close* (tutup grup)"
        );
      }
    } catch (err) {
      await context.reply(`Gagal mengubah pengaturan grup: ${err?.message || err}`);
    }
  },
};
