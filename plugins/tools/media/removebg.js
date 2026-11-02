import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { request } from "@/src/utils/request.js";

export default {
  name: "removebg",
  aliases: ["nobg", "hapusbg", "bgremove"],
  description: "Hapus background gambar (reply gambar)",
  usage: "(reply gambar)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) return reply("Reply gambar yang mau hapus background.\nContoh: reply foto lalu `.removebg`");
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 8 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil gambar: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca gambar.");
    await reply("Hapus background...");
    try {
      const form = new FormData();
      form.append("file", new Blob([buffer]), "image.png");
      let out = null;
      const endpoints = [
        "https://api.zyxhan.com/removebg",
        "https://rembg.zyxhan.com/api/remove",
        "https://api.remove.bg/v1.0/removebg",
      ];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(30000),
          });
          if (res.ok) {
            const arr = await res.arrayBuffer();
            if (arr.byteLength > 1000) {

              const head = Buffer.from(arr).slice(0, 20).toString();
              if (!head.includes("error") && !head.includes("Error")) {
                out = Buffer.from(arr);
                break;
              }
            }
          }
        } catch (_) {}
      }
      if (!out) {

        try {
          const sharp = (await import("sharp")).default;
          const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (r > 235 && g > 235 && b > 235) data[i + 3] = 0;
          }
          out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
            .png()
            .toBuffer();
          if (out.length < 1000) out = null;
        } catch (_) {}
      }
      if (!out) {
        return reply("Server removebg lagi sibuk, coba lagi nanti. Tips: pakai foto background putih/polos.");
      }
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: out, caption: "REMOVEBG DONE" },
        { quoted: msg }
      );
      await sock.sendMessage(
        msg.key.remoteJid,
        { document: out, mimetype: "image/png", fileName: `nobg-${Date.now()}.png` },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal removebg: ${err?.message || err}`);
    }
  },
};
