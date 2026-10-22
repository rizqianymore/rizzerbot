import { downloadMedia, probe } from "@/src/services/fetch/ytdlp/index.js";
import { request } from "@/src/utils/request.js";
import { describeVia } from "@/src/services/network/scraper/report.js";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

function isVideoInfo(info) {
  if (!info) return false;
  if (/^(mp4|mov|webm|mkv|m4v)$/i.test(info.ext || "")) return true;
  if (info.vcodec && info.vcodec !== "none") return true;
  return Array.isArray(info.formats) && info.formats.some((f) => f.vcodec && f.vcodec !== "none");
}

function pickImageUrl(info) {
  if (!info) return null;
  if (info.url && /^https?:\/\//i.test(info.url)) return info.url;
  if (Array.isArray(info.formats)) {
    const images = info.formats
      .filter((f) => f.url && /^https?:\/\//i.test(f.url) && (!f.vcodec || f.vcodec === "none"))
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
    if (images.length > 0) return images[0].url;
  }
  return info.thumbnail || null;
}

export default {
  name: "pindl",
  cooldownMs: 30000,
  aliases: ["pindownload", "pinurl", "pintdl"],
  description: "Download video & gambar Pinterest (pin.it / pinterest.com) resolusi asli.",
  usage: "<url>",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();

    const url = (args[0] || "").trim();
    const currentPrefix = prefix || ".";
    const remoteJid = msg.key.remoteJid;
    const usedVias = [];

    if (!url || !/^https?:\/\//i.test(url) || !/(pin\.it|pinterest\.[a-z.]+)\//i.test(url)) {
      return reply(
        `*PINTEREST DOWNLOADER*\n\n` +
          `Masukkan link Pinterest yang valid (pin.it / pinterest.com).\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}pindl https://pin.it/xxxxxx\`\n` +
          `\`${currentPrefix}pindl https://www.pinterest.com/pin/xxxxxx\``
      );
    }

    try {
      const info = await probe(url, {
        timeoutMs: 45000,
        logger,
        onVia: (via) => usedVias.push(via),
      }).catch((err) => {
        logger?.warn?.(`[pindl probe] ${err?.message || err}`);
        return null;
      });
      if (!info) {
        throw new Error("Gagal memuat informasi pin. Pastikan link publik dan dapat diakses.");
      }

      const title = (info.title || "Pinterest").toString().trim();
      const uploader = (info.uploader || info.creator || info.channel || "").toString().trim();

      const lines = ["*PINTEREST DOWNLOADER*"];
      if (title) lines.push(`Judul: ${title}`);
      if (uploader) lines.push(`Pembuat: ${uploader}`);

      if (isVideoInfo(info)) {
        await sendTyping();
        const dl = await downloadMedia(url, {
          mode: "video",
          quality: "1080",
          logger,
          onVia: (via) => usedVias.push(via),
        });
        if (!dl?.buffer?.length) throw new Error("Video Pinterest kosong / gagal diunduh.");

        const unlockerVia = usedVias.find((via) => via !== "direct");
        if (unlockerVia) lines.push(`🛡️ Diambil via ${describeVia(unlockerVia)}`);

        await sock.sendMessage(
          remoteJid,
          {
            video: dl.buffer,
            mimetype: "video/mp4",
            fileName: `Pinterest_${Date.now()}.mp4`,
            caption: lines.join("\n"),
          },
          { quoted: msg }
        );
        return;
      }

      const imageUrl = pickImageUrl(info);
      if (!imageUrl) throw new Error("URL gambar Pinterest tidak ditemukan.");

      await sendTyping();
      // Memakai request.buffer -> otomatis naik ke Web Unlocker / Scraping Browser
      // bila CDN Pinterest memblokir dengan proteksi.
      const buffer = await request.buffer(imageUrl, {
        timeout: 60000,
        maxBytes: 25 * 1024 * 1024,
        headers: {
          "User-Agent": UA,
          Referer: "https://www.pinterest.com/",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        },
        onVia: (via) => usedVias.push(via),
      });
      if (!buffer?.length) throw new Error("Gambar Pinterest kosong / gagal diunduh.");

      const unlockerVia = usedVias.find((via) => via !== "direct");
      if (unlockerVia) lines.push(`🛡️ Diambil via ${describeVia(unlockerVia)}`);

      await sock.sendMessage(remoteJid, { image: buffer, caption: lines.join("\n") }, { quoted: msg });
    } catch (err) {
      logger?.warn?.(`[pindl] ${err?.message || err}`);
      await reply(`Gagal mengunduh Pinterest: ${err?.message || "Media tidak ditemukan atau link privat."}`);
    }
  },
};
