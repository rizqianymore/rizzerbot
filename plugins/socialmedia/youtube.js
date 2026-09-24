export default [
  {
    name: "ytdlpro",
    aliases: ["ytdl", "yt"],
    description: "Download video/audio YouTube",
    premiumOnly: true,
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link YouTube! Contoh: *.ytdlpro https://youtu.be/xxx*");
      await reply("🚀 Mendownload video...");
      const isAudio = args[args.length - 1]?.toLowerCase() === "mp3";
      const { ytToolkitDownload, cobaltDownload, fetchBuffer } = await import("@/src/services/scrape.js");
      try {
        let result;
        try {
          result = await ytToolkitDownload(url, isAudio ? { type: "audio" } : { type: "video", quality: "720" });
        } catch (ytErr) {
          await reply(`⚠️ youtubetoolkit tidak bisa (${ytErr.message}). Coba via Cobalt...`);
          result = await cobaltDownload(url, isAudio ? { mode: "audio", audioFormat: "mp3" } : { mode: "video" });
        }
        const buffer = await fetchBuffer(result.url);
        await sock.sendMessage(
          msg.key.remoteJid,
          isAudio
            ? { audio: buffer, mimetype: "audio/mpeg" }
            : { video: buffer, mimetype: "video/mp4" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mendownload: ${err.message}`);
      }
    },
  },
];
