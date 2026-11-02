import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { upscaleImage } from "@/src/services/fetch/media/convert.js";

export default {
  name: "upscale",
  aliases: ["hd4x", "remini", "hdpro", "enhance"],
  description: "Upscale image 4x (HD Pro)",
  usage: "(reply gambar)",
  category: "Tools & Media",
  cooldownMs: 15000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply gambar yang mau di-upscale 4x.\nContoh: reply foto lalu `.upscale`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 10 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil gambar: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca gambar.");
    await reply("Upscale 4x...");
    try {
      const out = await upscaleImage(buffer, 4);
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: out, caption: "*UPSCALE 4X DONE*" },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal upscale: ${err?.message || err}`);
    }
  },
};
