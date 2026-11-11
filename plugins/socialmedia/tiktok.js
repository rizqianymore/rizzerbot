import {
  unifiedDownload,
  buildCaption,
  sniffMime,
  extractMultiMedia,
  parseMediaIndexSelection,
} from "@/src/services/fetch/downloaderCompat.js";
import { request } from "@/src/utils/request.js";

export default {
  name: "tiktok",
  cooldownMs: 30000,
  aliases: ["tt", "tikdl", "ttdl"],
  description: "Download TikTok video/music/slide foto — support pilih nomor foto",
  usage: "<url> [mp3 / nomor slide, cth: 1, 2, 1-3, all]",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, logger }) => {
    await sendTyping();
    const url = args.find((a) => /^https?:\/\//i.test(a)) || args[0]?.trim();
    if (!url) return reply("Masukkan link TikTok! Contoh: *.tiktok https://tiktok.com/@user/video/xxxx*");

    try {
      const isAudio = args.some((a) => a?.toLowerCase() === "mp3" || a?.toLowerCase() === "audio");
      const selectorArg = args.find((a) => a !== url && a?.toLowerCase() !== "mp3" && a?.toLowerCase() !== "audio");
      const remoteJid = msg.key.remoteJid;

      // 1. Cek apakah ini postingan slide foto TikTok
      if (!isAudio) {
        const multi = await extractMultiMedia(url, { isAudio: false, logger });
        if (multi.items && multi.items.length > 0) {
          const totalSlide = multi.items.length;
          let selectedIndices = null;
          if (selectorArg && totalSlide > 1) {
            selectedIndices = parseMediaIndexSelection(selectorArg, totalSlide);
          }

          const targetItems = selectedIndices
            ? multi.items.filter((_, idx) => selectedIndices.includes(idx))
            : multi.items;

          const baseCap = buildCaption("TIKTOK SLIDE", {
            title: multi.info?.title || "",
            author: multi.info?.uploader || multi.info?.author || "",
            duration: 0,
          });

          const caption = `${baseCap}\nTotal Slide: ${totalSlide} foto${
            selectedIndices ? `\nSlide Terpilih: ${selectedIndices.map((i) => i + 1).join(", ")}` : ""
          }`;

          for (let i = 0; i < targetItems.length; i++) {
            const item = targetItems[i];
            const itemCap = i === 0 ? caption : "";
            try {
              const buf = await request.buffer(item.url, { timeout: 25000 });
              await sock.sendMessage(remoteJid, { image: buf, caption: itemCap }, { quoted: msg });
            } catch (_) {
              await sock.sendMessage(remoteJid, { image: { url: item.url }, caption: itemCap }, { quoted: msg });
            }
          }
          return;
        }
      }

      // 2. Jika video atau audio biasa, unduh via unifiedDownload
      const { buffer, info } = await unifiedDownload(url, { mode: isAudio ? "audio" : "video", logger });
      if (!buffer?.length) throw new Error("Gagal mengunduh media TikTok.");

      const caption = buildCaption("TIKTOK", {
        title: info?.title || "",
        author: info?.uploader || info?.author || "",
        duration: info?.duration || 0,
      });

      const mimetype = sniffMime(buffer, isAudio ? "audio/mpeg" : "video/mp4");
      await sock.sendMessage(
        remoteJid,
        !isAudio
          ? mimetype.startsWith("image/")
            ? { image: buffer, caption }
            : { video: buffer, caption, mimetype: "video/mp4" }
          : { audio: buffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      await reply(`Gagal: ${err.message}`);
    }
  },
};
