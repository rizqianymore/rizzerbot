import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { request } from "@/src/utils/request.js";

export default {
  name: "ocr",
  aliases: ["readtext", "imagetext", "scantext", "bacagambar"],
  description: "Baca teks dari gambar (OCR) — reply gambar",
  usage: "(reply gambar)",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply("Reply gambar yang mau di-OCR.\nContoh: reply foto teks lalu `.ocr`");
    }
    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 8 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal ambil gambar: ${err?.message || err}`);
    }
    if (!buffer?.length) return reply("Gagal baca gambar.");

    try {
      const b64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      const body = new URLSearchParams({
        base64Image: b64,
        language: "eng",
        isOverlayRequired: "false",
        OCREngine: "2",
      }).toString();
      const data = await request.post("https://api.ocr.space/parse/image", body, {
        timeout: 20000,
        headers: {
          apikey: process.env.OCRSPACE_API_KEY || "helloworld",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        responseType: "json",
      });
      const text = data?.ParsedResults?.[0]?.ParsedText?.trim();
      if (text) {
        return reply(`*OCR HASIL:*\n${text.slice(0, 3500)}`);
      }

      const body2 = new URLSearchParams({
        base64Image: b64,
        language: "eng",
        OCREngine: "1",
      }).toString();
      const data2 = await request.post("https://api.ocr.space/parse/image", body2, {
        timeout: 20000,
        headers: {
          apikey: process.env.OCRSPACE_API_KEY || "helloworld",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        responseType: "json",
      });
      const text2 = data2?.ParsedResults?.[0]?.ParsedText?.trim();
      if (text2) return reply(`*OCR HASIL:*\n${text2.slice(0, 3500)}`);
    } catch (err) {
      return reply(`Gagal OCR: ${err?.message || err}`);
    }
    return reply("Tidak ada teks terbaca di gambar.");
  },
};
