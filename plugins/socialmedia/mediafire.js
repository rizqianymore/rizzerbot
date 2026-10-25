import { mediafireDownload } from "@/src/services/fetch/mediafire.js";
import { fetchBuffer } from "@/src/services/network/scrape.js";

export default {
  name: "mediafire",
  cooldownMs: 30000,
  aliases: ["mf", "mfdl"],
  description: "Download file langsung dari MediaFire (tanpa API pihak ketiga)",
  usage: "<url>",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!url || !/mediafire\.com/i.test(url)) {
      return reply(
        `*MEDIAFIRE DOWNLOADER*\n\n` +
          `Masukkan URL MediaFire yang valid.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}mediafire https://www.mediafire.com/file/xxxx/file\``
      );
    }

    const MAX_INLINE_MB = 40;
    const MAX_INLINE_BYTES = MAX_INLINE_MB * 1024 * 1024;

    const sizeInMb = (size = "") => {
      const text = String(size || "");
      const gb = text.match(/([\d.]+)\s*GB/i);
      if (gb) return parseFloat(gb[1]) * 1024;
      const mb = text.match(/([\d.]+)\s*MB/i);
      if (mb) return parseFloat(mb[1]);
      const kb = text.match(/([\d.]+)\s*KB/i);
      if (kb) return parseFloat(kb[1]) / 1024;
      return 0;
    };

    try {
      const data = await mediafireDownload(url);
      const { downloadUrl, filename, filesize, mimetype } = data;

      const lines = ["*MEDIAFIRE DOWNLOADER*"];
      if (filename) lines.push(`Nama: ${filename}`);
      if (filesize) lines.push(`Ukuran: ${filesize}`);
      if (downloadUrl) lines.push(`Link: ${downloadUrl}`);
      const infoText = lines.join("\n");

      if (sizeInMb(filesize) > MAX_INLINE_MB) {
        return reply(
          `${infoText}\n\nFile berukuran cukup besar (${filesize}). Silakan unduh langsung melalui link di atas.`
        );
      }

      const fileBuffer = await fetchBuffer(downloadUrl, {}, MAX_INLINE_BYTES);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          document: fileBuffer,
          fileName: filename,
          mimetype: mimetype || "application/octet-stream",
          caption: `Berhasil mengunduh *${filename}* (${filesize})`,
        },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[mediafire] ${err.message}`);
      await reply(`Gagal mendownload dari MediaFire: ${err.message}`);
    }
  },
};
