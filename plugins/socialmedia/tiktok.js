export default [
  {
    name: "tiktok",
    aliases: ["tt", "tikdl", "ttdl"],
    description: "Download TikTok video/music (tanpa watermark)",
    premiumOnly: true,
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");
      await reply("🎬 Mengunduh video TikTok...");
      try {
        const { tiktokDownload, fetchBuffer } = await import("@/src/services/scrape.js");
        const info = await tiktokDownload(url);
        const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
        const dlUrl = isAudio ? info.mp3 : info.noWatermark;
        if (!dlUrl) throw new Error("Gagal menemukan link download media TikTok.");
        const isVideo = !isAudio;
        const buffer = await fetchBuffer(dlUrl);
        const caption =
          `🎬 *TikTok Download*\n\n` +
          `*Author:* ${info.author} (@${info.uniqueId})\n` +
          (info.title ? `*Judul:* ${info.title}\n` : "") +
          `*Durasi:* ${info.duration}s\n` +
          `*Views:* ${info.playCount.toLocaleString()} | *Likes:* ${info.diggCount.toLocaleString()}`;
        await sock.sendMessage(
          msg.key.remoteJid,
          isVideo
            ? { video: buffer, caption, mimetype: "video/mp4" }
            : { audio: buffer, mimetype: "audio/mpeg", ptt: true },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },
];
