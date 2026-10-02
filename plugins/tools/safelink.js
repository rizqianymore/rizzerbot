// plugins/tools/safelink.js — Solver dan pemecah tautan Safelink / URL Shortener
import { solveSafelink, mediafireDownload } from "@/src/services/mediafire.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default {
  name: "safelink",
  aliases: ["bypass", "unshorten", "unshort"],
  description: "Bypass / decrypt tautan Safelink & shortener ke link asli",
  usage: "<url>",
  premiumOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const url = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `🔓 *SAFELINK SOLVER / BYPASS*\n\n` +
        `Masukkan URL safelink atau shortlink yang ingin di-bypass.\n\n` +
        `*Contoh:*\n` +
        `\`${currentPrefix}safelink https://safefileku.com/download/xxxx\``
      );
    }

    await reply("🔍 Menganalisis dan mem-bypass tautan safelink...");

    try {
      const result = await solveSafelink(url);
      const { targetUrl, type } = result;

      let responseText =
        `🔓 *SAFELINK BYPASS SUCCESS*\n\n` +
        `🔗 *Link Awal:* ${url}\n` +
        `🎯 *Target Link:* ${targetUrl}\n` +
        `🏷️ *Tipe:* ${type.toUpperCase()}\n`;

      // Jika target URL adalah MediaFire, tawarkan/langsung ambil detailnya
      if (/mediafire\.com/i.test(targetUrl)) {
        responseText += `\n⏳ Terdeteksi MediaFire, sedang mengambil link unduhan langsung...`;
        await reply(responseText);

        try {
          const mfData = await mediafireDownload(targetUrl);
          const { downloadUrl, filename, filesize, mimetype } = mfData;

          await reply(
            `📁 *MEDIAFIRE FOUND*\n\n` +
            `📄 *Nama:* ${filename}\n` +
            `📊 *Ukuran:* ${filesize}\n` +
            `⬇️ *Direct Link:*\n${downloadUrl}`
          );

          const isLarge = /\b\d+\s*GB/i.test(filesize) || (/(\d+)\s*MB/i.test(filesize) && parseInt(filesize.match(/(\d+)\s*MB/i)[1], 10) > 95);
          if (!isLarge) {
            const fileBuffer = await fetchBuffer(downloadUrl);
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                document: fileBuffer,
                fileName: filename,
                mimetype: mimetype || "application/octet-stream",
                caption: `✅ File hasil bypass: *${filename}* (${filesize})`,
              },
              { quoted: msg }
            );
          }
        } catch (mfErr) {
          await reply(`⚠️ Link MediaFire ditemukan, namun gagal auto-download: ${mfErr.message}`);
        }
      } else {
        await reply(responseText);
      }
    } catch (err) {
      console.error("[Safelink Error]:", err);
      reply(`❌ Gagal mem-bypass safelink: ${err.message}`);
    }
  },
};
