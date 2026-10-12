import {
  getMediaBuffer,
  upscaleImage,
  findDownloadableTarget,
} from '@/src/services/fetch/media.js';

export default {
  "name": "hd",
  "description": "Upscale image to HD (2x)",
  "usage": "(reply gambar)",
  "premiumOnly": true,
  "category": "Premium",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const targetMsg = findDownloadableTarget(msg);
      let buffer = null;
      try {
        buffer = targetMsg ? await getMediaBuffer(sock, targetMsg) : null;
      } catch (err) {
        return reply(`❌ ${err?.message || "Gagal membaca media."}`);
      }
      if (!buffer) return reply("❌ Balas/buka gambar dengan caption *\\.hd*");
      await reply("✨ Memproses gambar ke HD...");
      try {
        const hdBuffer = await upscaleImage(buffer, 2);
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: hdBuffer, caption: "✨ *HASIL UPSCALE HD (2X)*" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal memproses: ${err.message}`);
      }
    },
};
