import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { smartUpload } from "@/src/services/fetch/fileUploader.js";
import { formatBytes } from "@/src/utils/format.js";

function getMimeExtension(mime) {
  if (!mime) return "bin";
  const m = String(mime).toLowerCase();
  if (m.includes("image/jpeg") || m.includes("image/jpg")) return "jpg";
  if (m.includes("image/png")) return "png";
  if (m.includes("image/webp")) return "webp";
  if (m.includes("image/gif")) return "gif";
  if (m.includes("video/mp4")) return "mp4";
  if (m.includes("audio/mpeg") || m.includes("audio/mp3")) return "mp3";
  if (m.includes("audio/ogg")) return "ogg";
  if (m.includes("application/pdf")) return "pdf";
  if (m.includes("application/zip")) return "zip";
  return "bin";
}

export default {
  name: "tourl",
  aliases: ["upload", "tolink", "uploadfile", "catbox", "quax"],
  description: "Upload gambar, video, audio, atau dokumen ke URL publik offshore (Catbox / Qu.ax / Uguu)",
  usage: "[reply media]",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const target = findDownloadableTarget(msg);

    if (!target) {
      return reply(
        `*CARA UPLOAD MEDIA KE URL:*\n\n` +
          `Reply pesan gambar, video, audio, stiker, atau dokumen lalu ketik:\n` +
          `│ \`${p}tourl\` (Auto Failover Catbox -> Qu.ax -> Uguu)\n` +
          `│ \`${p}tourl quax\` (Prioritas Qu.ax)\n` +
          `│ \`${p}tourl uguu\` (Prioritas Uguu - 3 jam)\n\n` +
          `Mendukung file hingga 100 MB.`
      );
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 100 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal membaca file media: ${err?.message || err}`);
    }

    if (!buffer?.length) {
      return reply("Media kosong atau gagal diunduh.");
    }

    const providerArg = (args[0] || "").toLowerCase();
    await reply("Mengunggah file ke cloud offshore...");

    const ext = getMimeExtension(target.mimetype);
    const filename = `rizzerbot-${Date.now()}.${ext}`;

    try {
      const res = await smartUpload(buffer, filename, providerArg);
      const sizeStr = typeof formatBytes === "function" ? formatBytes(res.sizeBytes) : `${(res.sizeBytes / 1024 / 1024).toFixed(2)} MB`;

      const text =
        `*BERHASIL UPLOAD FILE*\n\n` +
        `│ *URL:* ${res.url}\n` +
        `│ *Host:* ${res.provider}\n` +
        `│ *Ukuran:* ${sizeStr}\n` +
        `│ *Retensi:* ${res.retention}\n\n` +
        `_Tautan dapat langsung diakses publik dan dibagikan._`;

      return reply(text);
    } catch (err) {
      return reply(`Gagal upload media: ${err?.message || err}`);
    }
  },
};
