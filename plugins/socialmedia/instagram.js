export default [
  {
    name: "igdl",
    aliases: ["ig", "instagram"],
    description: "Download Instagram media (Reels/Post) via link",
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const url = args[0];
      if (!url) return reply("❌ Masukkan link Instagram! Contoh: *.igdl https://instagram.com/p/xxxx*");
      await reply("🔗 Mengunduh media Instagram...");
      try {
        const { cobaltDownload, fetchBuffer } = await import("@/src/services/scrape.js");
        const result = await cobaltDownload(url, { mode: "video" });
        const buffer = await fetchBuffer(result.url);
        await sock.sendMessage(
          msg.key.remoteJid,
          { video: buffer, mimetype: "video/mp4" },
          { quoted: msg }
        );
        await reply("✅ Berhasil mengunduh media Instagram!");
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },
];
