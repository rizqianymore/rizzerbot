import { getMediaBuffer, findDownloadableTarget, upscaleImage } from "@/src/services/fetch/media.js";
import { getSharp } from "@/src/utils/native.js";

export default {
  name: "hdfree",
  aliases: ["hd2", "enhance2"],
  description: "HD-kan gambar 2x gratis tanpa API (free, non-premium)",
  usage: "reply gambar",
  category: "Tools",
  cooldownMs: 10000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply gambar yang mau di-HD-kan.\nContoh: reply foto lalu `.hd`");

    // ensure target is image
    const content = target.message || {};
    const type = Object.keys(content)[0] || "";
    const isImage = type === "imageMessage" || !!content.imageMessage;
    if (!isImage) return reply("Reply gambar yang mau di-HD-kan.\nContoh: reply foto lalu `.hd`");

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 10 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil gambar: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca gambar.");

    await reply("Proses HD 2x...");
    try {
      let out;
      try {
        out = await upscaleImage(buffer, 2);
      } catch (err) {
        // fallback to sharp directly
        const sharp = getSharp();
        if (!sharp) throw err;
        const img = sharp(buffer);
        const meta = await img.metadata();
        const width = Math.round((meta.width || 500) * 2);
        const height = Math.round((meta.height || 500) * 2);
        out = await img.resize(width, height, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        { image: out, caption: "✨ HD 2x" },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal HD: ${err?.message || err}`);
    }
  },
};
