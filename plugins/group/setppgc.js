import { getGroupContext } from "./_context.js";
import { findDownloadableTarget, getMediaBuffer } from "@/src/services/fetch/media.js";

export default {
  name: "setppgc",
  aliases: ["setppgrup", "setppgroup"],
  description: "Mengubah foto profil (ikon) grup WhatsApp dengan reply/kirim gambar",
  usage: "(reply foto)",
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

    const target = findDownloadableTarget(msg);
    if (!target || target.type !== "image") {
      return context.reply("Kirim gambar dengan caption *.setppgc* atau balas (reply) foto yang ingin dijadikan foto grup!");
    }

    try {
      const buffer = await getMediaBuffer(target);
      if (!buffer || buffer.length === 0) {
        throw new Error("Gagal mengunduh gambar foto profil.");
      }

      await sock.updateProfilePicture(ctx.remoteJid, buffer);
      await context.reply("✅ Foto profil grup berhasil diperbarui!");
    } catch (err) {
      await context.reply(`Gagal memperbarui foto profil grup: ${err?.message || err}`);
    }
  },
};
