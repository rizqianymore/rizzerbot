import { findDownloadableTarget, getMediaBuffer } from "@/src/services/fetch/media.js";

export default {
  name: "setppbot",
  aliases: ["setpp", "setbotpp"],
  description: "Mengubah foto profil WhatsApp bot dengan reply foto",
  usage: "(reply foto)",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target || target.type !== "image") {
      return reply("Kirim gambar dengan caption *.setppbot* atau balas (reply) foto yang ingin dijadikan PP bot!");
    }

    try {
      const buffer = await getMediaBuffer(target);
      if (!buffer || buffer.length === 0) {
        throw new Error("Gagal mengunduh gambar.");
      }

      await sock.updateProfilePicture(sock.user?.id, buffer);
      await reply("✅ Foto profil bot berhasil diperbarui!");
    } catch (err) {
      await reply(`Gagal memperbarui foto profil bot: ${err?.message || err}`);
    }
  },
};
