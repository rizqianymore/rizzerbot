import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "capcut",
  aliases: ["capcutdl", "ccdl", "capcutdownload"],
  description: "Download video CapCut template (tanpa watermark)",
  usage: "<url capcut>, cth: capcut https://www.capcut.com/template-detail/xxx",
  category: "Downloader & Media",
  cooldownMs: 15000,
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const url = (args[0] || "").trim();
    if (!url || !/capcut\.com/i.test(url)) {
      return reply("Kirim link CapCut!\nContoh: `.capcut https://www.capcut.com/template-detail/123`");
    }
    await sendTyping();
    try {
      const { buffer, info } = await unifiedDownload(url, { mode: "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh video CapCut.");
      const mime = sniffMime(buffer, "video/mp4");
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: buffer, mimetype: mime, caption: `*CAPCUT*\n${info?.title || ""}`.trim() },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[capcut] ${err?.message || err}`);
      return reply(`Gagal CapCut: ${err?.message || err}`);
    }
  },
};
