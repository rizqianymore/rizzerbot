export default {
  name: "tiktok",
  cooldownMs: 30000,
  aliases: ["tt", "tikdl", "ttdl"],
  description: "Download TikTok video/music (tanpa watermark)",
  usage: "<url> [mp3]",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args[0];
    if (!url) return reply("Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");
    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      let buffer;
      let title = "";
      let author = "";
      let duration = "";

      try {
        const { downloadTiktok } = await import("@/src/services/fetch/kolid.js");
        const { fetchBuffer } = await import("@/src/services/network/scrape.js");
        const info = await downloadTiktok(url);
        const dlUrl = isAudio ? info?.mp3 : info?.noWatermark || info?.watermark;
        if (!dlUrl) throw new Error("kol.id tidak mengembalikan link media.");
        buffer = await fetchBuffer(dlUrl, {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
          Referer: "https://kol.id/",
        });
        title = info.title || "";
        author = info.author ? `${info.author}${info.uniqueId ? ` (@${info.uniqueId})` : ""}` : "";
        duration = info.duration ? `${info.duration}s` : "";
      } catch (kolErr) {
        logger?.warn?.(`[tiktok kol.id] ${kolErr?.message || kolErr}`);
        try {
          const { tiktokDownload, fetchBuffer } = await import("@/src/services/network/scrape.js");
          const info = await tiktokDownload(url);
          const dlUrl = isAudio ? info.mp3 : info.noWatermark;
          if (!dlUrl) throw new Error("Gagal menemukan link download media TikTok.");
          buffer = await fetchBuffer(dlUrl, {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
            Referer: "https://snaptik.fi/",
          });
          title = info.title || "";
          author = info.author ? `${info.author}${info.uniqueId ? ` (@${info.uniqueId})` : ""}` : "";
          duration = info.duration ? `${info.duration}s` : "";
        } catch (scrapeErr) {
          logger?.warn?.(`[tiktok snaptik] ${scrapeErr?.message || scrapeErr}`);
          const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
          const [pInfo, dl] = await Promise.all([
            probe(url, { timeoutMs: 20000 }).catch(() => null),
            downloadMedia(url, { mode: isAudio ? "audio" : "video" }),
          ]);
          buffer = dl.buffer;
          title = pInfo?.title || "";
          author = pInfo?.uploader || "";
          if (pInfo?.duration) duration = `${pInfo.duration}s`;
        }
      }

      const lines = ["*TIKTOK DOWNLOADER*"];
      if (title) lines.push(`Judul: ${title}`);
      if (author) lines.push(`Author: ${author}`);
      if (duration) lines.push(`Durasi: ${duration}`);
      const caption = lines.join("\n");

      await sock.sendMessage(
        msg.key.remoteJid,
        !isAudio
          ? { video: buffer, caption, mimetype: "video/mp4" }
          : { audio: buffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal: ${err.message}`);
    }
  },
};
