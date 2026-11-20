import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";
import { request } from "@/src/utils/request.js";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

export default {
  name: "pindl",
  cooldownMs: 15000,
  aliases: ["pindownload", "pinurl", "pintdl"],
  description: "Download video & gambar Pinterest (pin.it / pinterest.com) resolusi asli.",
  usage: "<url>",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    sendTyping();

    const url = (args[0] || "").trim();
    const currentPrefix = prefix || ".";
    const remoteJid = msg.key.remoteJid;

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

      const res = await unifiedDownload(url, { mode: "video", logger, timeoutMs: 15000 }).catch(() => null);
      if (res?.buffer?.length > 100) {
        const mime = sniffMime(res.buffer);
        const title = res.info?.title || "Pinterest Media";
        const caption = `*PINTEREST DOWNLOADER*\nJudul: ${title}`;

        if (mime.startsWith("image/")) {
          return await sock.sendMessage(remoteJid, { image: res.buffer, caption }, { quoted: msg });
        } else {
          return await sock.sendMessage(
            remoteJid,
            { video: res.buffer, mimetype: "video/mp4", caption },
            { quoted: msg }
          );
        }
      }

      const html = await request
        .text(url, {
          headers: { "User-Agent": UA, Referer: "https://www.pinterest.com/" },
          timeout: 8000,
        })
        .catch(() => "");

      const origImg = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\/.]+\.(jpg|png|webp|jpeg)/i)?.[0];
      const videoMatch = html.match(/https:\/\/[^"'\s]+\.mp4/i)?.[0];
      const targetMedia = videoMatch || origImg;

      if (!targetMedia) {
        throw new Error("Media tidak ditemukan atau pin bersifat privat.");
      }

      const mediaBuf = await request.buffer(targetMedia, {
        timeout: 15000,
        headers: { "User-Agent": UA, Referer: "https://www.pinterest.com/" },
      });

      if (!mediaBuf?.length) throw new Error("Gagal mengunduh buffer media Pinterest.");

      const mime = sniffMime(mediaBuf);
      const caption = `*PINTEREST DOWNLOADER*`;

      if (mime.startsWith("image/")) {
        return await sock.sendMessage(remoteJid, { image: mediaBuf, caption }, { quoted: msg });
      } else {
        return await sock.sendMessage(remoteJid, { video: mediaBuf, mimetype: "video/mp4", caption }, { quoted: msg });
      }
    } catch (err) {
      logger?.warn?.(`[pindl] ${err?.message || err}`);
      await reply(`Gagal mengunduh Pinterest: ${err?.message || "Media tidak ditemukan atau link privat."}`);
    }
  },
};
