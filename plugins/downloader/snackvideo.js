import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export default {
  name: "snackvideo",
  aliases: ["snackdl", "snack", "svdl"],
  description: "Download video SnackVideo (no watermark)",
  usage: "<url snackvideo>, cth: snackvideo https://www.snackvideo.com/@user/video/xxx",
  category: "Downloader & Media",
  cooldownMs: 15000,
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    const url = (args[0] || "").trim();
    if (!url || !/snackvideo\.com/i.test(url)) {
      return reply("Kirim link SnackVideo!\nContoh: `.snackvideo https://www.snackvideo.com/@...`");
    }
    await sendTyping();
    try {
      const { buffer, info } = await unifiedDownload(url, { mode: "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh SnackVideo.");
      const mime = sniffMime(buffer, "video/mp4");
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: buffer, mimetype: mime, caption: `*SNACKVIDEO*\n${info?.title || ""}`.trim() },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[snackvideo] ${err?.message || err}`);
      return reply(`Gagal SnackVideo: ${err?.message || err}`);
    }
  },
};
