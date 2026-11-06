import { askGeminiVision } from "@/src/services/ai/vision.js";
import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "vision",
  aliases: ["aivision", "lihat", "analisis", "tanyafoto"],
  description: "Analisis isi gambar, soal matematika, teks, atau invoice dengan AI Multi-Modal",
  usage: "<balas foto / kirim foto dengan caption> [pertanyaan]",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply(
        `*AI MULTI-MODAL VISION*\n\n` +
          `Format Penggunaan:\n` +
          `1. Kirim foto dengan caption: *${prefix}vision <pertanyaan>*\n` +
          `2. Atau balas (*reply*) foto yang sudah ada dengan: *${prefix}vision <pertanyaan>*\n\n` +
          `Contoh:\n` +
          `• *${prefix}vision Selesaikan soal matematika di kertas ini*\n` +
          `• *${prefix}vision Total belanja di struk ini berapa?*\n` +
          `• *${prefix}vision Terjemahkan dan ringkas teks di gambar ini*`
      );
    }

    await sendTyping();
    const prompt = args.join(" ").trim() || "Jelaskan gambar ini secara detail dan informatif dalam bahasa Indonesia.";

    let buffer = null;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 15 * 1024 * 1024 });
    } catch (err) {
      return reply(`[FAIL] Gagal mengunduh gambar: ${err.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return reply("Gagal mengambil file gambar untuk dianalisis.");
    }

    await reply("Menganalisis gambar dengan AI Vision...");
    try {
      const result = await askGeminiVision(buffer, prompt);
      const output = `*AI VISION RESULT*\n\n${result}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*AI VISION GAGAL*\n${err?.message || "Terjadi kesalahan saat memproses gambar."}`);
    }
  },
};
