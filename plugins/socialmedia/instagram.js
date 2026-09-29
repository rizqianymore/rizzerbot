import instagramDownloader from "@/src/scraper/ig.js";

const IG_REGEX = /instagram\.com\/(p|reel|reels|stories|tv)\//i;

export default [
  {
    name: "igdl",
    aliases: ["ig", "instagram", "instagramdl"],
    description: "Download video/foto Instagram",
    category: "Social Media",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      const url = args[0]?.trim();
      const currentPrefix = prefix || ".";

      if (!url) {
        return reply(
          `📸 *INSTAGRAM DOWNLOADER*\n\n` +
            `Gunakan: \`${currentPrefix}igdl <url>\`\n\n` +
            `*Contoh:*\n` +
            `> \`${currentPrefix}igdl https://www.instagram.com/reel/xxx\`\n` +
            `> \`${currentPrefix}igdl https://www.instagram.com/p/xxx\``
        );
      }

      if (!IG_REGEX.test(url)) {
        return reply("❌ URL tidak valid. Gunakan link Instagram (reel/post/story/tv).");
      }

      await sendTyping();
      await reply("⏳ Mengunduh media Instagram...");

      try {
        const result = await instagramDownloader(url);

        if (!result?.media?.length) {
          return reply("❌ Gagal mengambil media dari Instagram.");
        }

        const remoteJid = msg.key.remoteJid;
        const author = result.username && result.username !== "-" ? `@${result.username}` : "";
        const title = result.caption ? result.caption.slice(0, 100) : "";

        // Output caption yang clean dan simpel
        let caption = `📸 *Instagram Downloader*`;
        if (author) caption += `\n👤 *Author:* ${author}`;
        if (title) caption += `\n📝 *Caption:* ${title}${result.caption.length > 100 ? "..." : ""}`;

        for (const item of result.media) {
          const isVideo = item.type === "video";
          if (isVideo) {
            await sock.sendMessage(
              remoteJid,
              { video: { url: item.url }, caption },
              { quoted: msg }
            );
          } else {
            await sock.sendMessage(
              remoteJid,
              { image: { url: item.url }, caption },
              { quoted: msg }
            );
          }
          caption = ""; // Hanya kirim caption di media pertama agar simpel
        }
      } catch (err) {
        return reply(`❌ *Gagal mengunduh:*\n> ${err.message}`);
      }
    },
  },
];
