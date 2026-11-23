import { clean, cleanText } from "@/src/services/fetch/igdl/utils.js";
import {
  unifiedDownload,
  sniffMime,
  extractMultiMedia,
  parseMediaIndexSelection,
} from "@/src/services/fetch/downloaderCompat.js";
import { sendImage, sendVideo } from "@/src/services/fetch/igdl/sender.js";

export default {
  name: "igdl",
  cooldownMs: 30000,
  aliases: ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  description: "Download video/foto/carousel Instagram — support pilih nomor slide atau download semua",
  usage: "<url> [nomor slide, cth: 1, 2, 1-3, all]",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const remoteJid = msg.key.remoteJid;
    const currentPrefix = prefix || ".";

    const urlArg = args.find((a) => /^https?:\/\//i.test(a)) || args[0] || "";
    const input = clean(urlArg);

    if (!input) {
      return reply(
        `┌── INSTAGRAM DOWNLOADER\n` +
          `│ Format: ${currentPrefix}igdl <url> [nomor slide]\n` +
          `└─\n\n` +
          `Contoh: ${currentPrefix}igdl https://instagram.com/p/xxxx`
      );
    }

    const selectorArg = args.find((a) => a !== urlArg && !/^https?:\/\//i.test(a));
    await sendTyping();

    try {
      const multi = await extractMultiMedia(input, { logger });
      let mediaList = multi.items || [];
      const info = multi.info || {};

      if (mediaList.length === 0) {
        const { buffer, info: uInfo } = await unifiedDownload(input, { mode: "video", logger });
        if (buffer?.length) {
          const mime = sniffMime(buffer);
          mediaList.push({
            type: mime.startsWith("image/") ? "image" : "video",
            buffer,
          });
          Object.assign(info, uInfo || {});
        }
      }

      if (mediaList.length === 0) {
        throw new Error("Media tidak ditemukan atau akun privat.");
      }

      let selectedIndices = null;
      if (selectorArg && mediaList.length > 1) {
        selectedIndices = parseMediaIndexSelection(selectorArg, mediaList.length);
      }

      const targetItems = selectedIndices ? mediaList.filter((_, idx) => selectedIndices.includes(idx)) : mediaList;

      const lines = ["*INSTAGRAM DOWNLOADER*"];
      if (info.author || info.uploader) lines.push(`Author: ${cleanText(info.author || info.uploader)}`);
      if (info.title) lines.push(`Judul: ${cleanText(String(info.title).slice(0, 120))}`);
      if (mediaList.length > 1) {
        lines.push(`Total Slide: ${mediaList.length} media`);
        if (selectedIndices) {
          lines.push(`Slide Terpilih: ${selectedIndices.map((i) => i + 1).join(", ")}`);
        }
      }
      const caption = lines.join("\n");

      for (let i = 0; i < targetItems.length; i++) {
        const item = targetItems[i];
        const isFirst = i === 0;
        const itemCap = isFirst ? caption : "";

        if (item.type === "image") {
          await sendImage(sock, remoteJid, msg, item, itemCap);
        } else {
          await sendVideo(sock, remoteJid, msg, item, itemCap);
        }
      }
    } catch (e) {
      logger?.warn?.(`[igdl] ${e?.message || e}`);
      return reply(`Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
    }
  },
};
