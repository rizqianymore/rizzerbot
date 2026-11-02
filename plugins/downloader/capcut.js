import { downloadMedia, probe } from "@/src/services/fetch/ytdlp.js";

export default {
  name: "capcut",
  aliases: ["capcutdl", "ccdl", "capcutdownload"],
  description: "Download video CapCut template (tanpa watermark via yt-dlp)",
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
      const info = await probe(url, { timeoutMs: 30000 }).catch(() => null);
      const dl = await downloadMedia(url, { mode: "video", quality: "720" });
      if (!dl?.buffer?.length) throw new Error("Gagal download CapCut.");
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: dl.buffer, mimetype: "video/mp4", caption: `*CAPCUT*\n${info?.title || ""}`.trim() },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[capcut] ${err?.message || err}`);
      return reply(`Gagal CapCut: ${err?.message || err}`);
    }
  },
};
