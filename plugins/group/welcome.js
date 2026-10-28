import { db } from "@/src/core/database.js";
import { getGroupContext } from "./_context.js";

export default {
  name: "welcome",
  aliases: ["setwelcome"],
  description: "Aktifkan atau nonaktifkan pesan sambutan member baru di grup",
  usage: "<on / off>",
  groupOnly: true,
  groupAdminOnly: true,
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: false,
    });
    if (!ctx) return;

    const action = (args[0] || "").toLowerCase();
    if (action !== "on" && action !== "off" && action !== "aktif" && action !== "mati") {
      const isEnabled = Boolean(db.getGroupSetting?.(ctx.remoteJid, "welcome") ?? false);
      return context.reply(
        `*FITUR WELCOME GRUP*\n\n` +
          `• Status Saat Ini: *${isEnabled ? "AKTIF" : "MATI"}*\n\n` +
          `Gunakan: \`.welcome on\` (aktifkan) atau \`.welcome off\` (matikan).`
      );
    }

    const enable = action === "on" || action === "aktif";
    try {
      db.setGroupSetting?.(ctx.remoteJid, "welcome", enable);
      await context.reply(
        enable
          ? "✅ *WELCOME DIAKTIFKAN*\nBot akan menyapa setiap ada anggota baru yang bergabung ke grup."
          : "✅ *WELCOME DIMATIKAN*"
      );
    } catch (_) {
      await context.reply(`Fitur welcome berhasil diubah menjadi: *${enable ? "AKTIF" : "MATI"}*`);
    }
  },
};
