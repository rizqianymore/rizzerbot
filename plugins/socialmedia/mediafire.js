// plugins/socialmedia/mediafire.js — Download file dari MediaFire tanpa API pihak ketiga
import { mediafireDownload } from "@/src/services/mediafire.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default {
  name: "mediafire",
  aliases: ["mf", "mfdl"],
  description: "Download file langsung dari MediaFire (tanpa API pihak ketiga)",
  usage: "<url>",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const url = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!url || !/mediafire\.com/i.test(url)) {
      return reply(
        `📁 *MEDIAFIRE DOWNLOADER*\n\n` +
        `Masukkan URL MediaFire yang valid.\n\n` +
        `*Contoh:*\n` +
        `\`${currentPrefix}mediafire https://www.mediafire.com/file/xxxx/file\``
      );
    }

    await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      const data = await mediafireDownload(url);
      const { downloadUrl, filename, filesize, mimetype } = data;

      const lines = ["*MEDIAFIRE DOWNLOADER*"];
      if (filename) lines.push(`Nama: ${filename}`);
      if (filesize) lines.push(`Ukuran: ${filesize}`);
      if (downloadUrl) lines.push(`Link: ${downloadUrl}`);
      const infoText = lines.join("\n");

      // Coba download file jika ukuran wajar (< 100MB untuk WhatsApp)
      // Cek apakah ukuran file di bawah batas
      const isLarge = /\b\d+\s*GB/i.test(filesize) || (/(\d+)\s*MB/i.test(filesize) && parseInt(filesize.match(/(\d+)\s*MB/i)[1], 10) > 95);

      if (isLarge) {
        return reply(`⚠️ File berukuran cukup besar (${filesize}). Silakan unduh langsung melalui link di atas.`);
      }

      const fileBuffer = await fetchBuffer(downloadUrl);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          document: fileBuffer,
          fileName: filename,
          mimetype: mimetype || "application/octet-stream",
          caption: `✅ Berhasil mengunduh *${filename}* (${filesize})`,
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[MediaFire DL Error]:", err);
      reply(`❌ Gagal mendownload dari MediaFire: ${err.message}`);
    }
  },
};
