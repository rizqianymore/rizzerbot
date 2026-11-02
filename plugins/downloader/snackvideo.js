import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "snackvideo",
  aliases: ["snackdl", "snack", "svdl"],
  description: "Download video SnackVideo (no watermark via yt-dlp)",
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
      const info = await probe(url, { timeoutMs: 30000 }).catch(() => null);
      const dl = await downloadMedia(url, { mode: "video", quality: "720" });
      if (!dl?.buffer?.length) throw new Error("Gagal download SnackVideo.");
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: dl.buffer, mimetype: "video/mp4", caption: `*SNACKVIDEO*\n${info?.title || ""}`.trim() },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[snackvideo] ${err?.message || err}`);
      return reply(`Gagal SnackVideo: ${err?.message || err}`);
    }
  },
};
