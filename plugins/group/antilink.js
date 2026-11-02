import { db } from "@/src/core/database.js";
import { getGroupContext } from "./_context.js";

export default {
  name: "antilink",
  aliases: ["anti-link"],
  description: "Aktifkan atau nonaktifkan proteksi anti link grup WhatsApp",
  usage: "<on / off>",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  category: "Group",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const ctx = await getGroupContext(sock, msg, context, {
      requireUserAdmin: true,
      requireBotAdmin: true,
    });
    if (!ctx) return;

    const action = (args[0] || "").toLowerCase();
    if (action !== "on" && action !== "off" && action !== "aktif" && action !== "mati") {
      const current = db.isAntilink(ctx.remoteJid);
      return context.reply(
        `*STATUS ANTI-LINK*\n\n` +
          `• Status: ${current ? "AKTIF" : "MATI"}\n\n` +
          `Gunakan: .antilink on (aktifkan) atau .antilink off (matikan).`
      );
    }

    const enable = action === "on" || action === "aktif";
    db.setAntilink(ctx.remoteJid, enable);
    await context.reply(
      enable
        ? "*ANTI-LINK DIAKTIFKAN*\nMember non-admin yang mengirim tautan grup WhatsApp akan dihapus pesannya secara otomatis."
        : "*ANTI-LINK DIMATIKAN*"
    );
  },
};
