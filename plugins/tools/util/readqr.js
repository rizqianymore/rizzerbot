import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "readqr",
  aliases: ["qrread", "decodeqr", "bacaqr"],
  description: "Baca QR dari gambar (reply gambar QR)",
  usage: "(reply gambar QR)",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply("Reply gambar QR yang mau dibaca.\nContoh: reply foto QR lalu ketik `.readqr`");
    }
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 8 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil gambar: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal membaca gambar.");

    // coba API gratis dulu (tanpa lokal berat)
    try {
      const form = new FormData();
      form.append("file", new Blob([buffer]), "qr.png");
      const res = await fetch("https://api.qrserver.com/v1/read-qr-code/", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      const decoded = data?.[0]?.symbol?.[0]?.data;
      if (decoded) {
        return reply(`*QR DECODED:*\n${decoded}`);
      }
    } catch (_) {}

    // fallback lokal jsqr + sharp
    try {
      const { default: jsqr } = await import("jsqr");
      const sharpMod = await import("sharp").then((m) => m.default || m).catch(() => null);
      if (sharpMod && jsqr) {
        const { data, info } = await sharpMod(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const clamped = new Uint8ClampedArray(data);
        const code = jsqr(clamped, info.width, info.height);
        if (code?.data) {
          return reply(`*QR DECODED:*\n${code.data}`);
        }
      }
    } catch (_) {}

    return reply("QR tidak terbaca. Pastikan gambar jelas dan tidak blur.");
  },
};
