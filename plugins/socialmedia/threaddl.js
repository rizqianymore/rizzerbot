import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";
import { request } from "@/src/utils/request.js";

export default {
  name: "threaddl",
  cooldownMs: 30000,
  aliases: ["tdl", "threads", "threadsdl"],
  description: "Download foto dan video dari postingan Threads — auto convert",
  usage: "<url>",
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();
    const url = args[0]?.trim();
    const currentPrefix = prefix || ".";

    if (!url || !/threads/i.test(url)) {
      return reply(
        `*THREADS DOWNLOADER*\n\n` +
          `Masukkan link postingan Threads yang ingin diunduh.\n\n` +
          `*Contoh:*\n` +
          `\`${currentPrefix}tdl https://www.threads.net/@zuck/post/xxx\``
      );
    }

    try {
      // unified dulu (yt-dlp + socialdownloader) — lebih stabil dari workers API
      const { buffer, info } = await unifiedDownload(url, { mode: "video", logger });
      if (!buffer?.length) throw new Error("Gagal ambil media Threads");
      const mime = sniffMime(buffer);
      const lines = ["*THREADS DOWNLOADER*"];
      if (info?.title) lines.push(`Deskripsi: ${String(info.title).slice(0, 150)}`);
      if (info?.uploader) lines.push(`Author: ${info.uploader}`);
      const caption = lines.join("\n");
      const remoteJid = msg.key.remoteJid;
      if (mime.startsWith("image/")) {
        await sock.sendMessage(remoteJid, { image: buffer, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(remoteJid, { video: buffer, caption, mimetype: "video/mp4" }, { quoted: msg });
      }
      return;
    } catch (uniErr) {
      logger?.warn?.(`[threaddl unified] ${uniErr?.message || uniErr}`);
    }

    // fallback lama: workers API hanya sebagai cadangan terakhir
    const BASE_URL = "https://workers-playground-cool-wood-c008.accoutydusra.workers.dev";
    const decodeEntities = (str = "") =>
      String(str || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    const uniqueByUrl = (list = []) => {
      const seen = new Set();
      const result = [];
      for (const item of list) {
        if (!item?.url || seen.has(item.url)) continue;
        seen.add(item.url);
        result.push(item);
      }
      return result;
    };
    try {
      const data = await request.json(BASE_URL, {
        timeout: 20000,
        params: { url, action: "info" },
        headers: {
          "sec-ch-ua-platform": `"Android"`,
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
          accept: "application/json",
          "content-type": "application/json",
          origin: "https://threadsvid.com",
          referer: "https://threadsvid.com/",
          "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        bypassCloudflare: "auto",
      });
      const info = data.data || {};
      const videoQualities = uniqueByUrl(info.video?.qualities || []);
      const images = uniqueByUrl(info.images?.urls || []);
      const mediaResults = [
        ...videoQualities.map((item) => ({ type: "video", url: item.url })),
        ...images.map((item) => ({ type: "image", url: item.url })),
      ];
      if (data?.success !== true || mediaResults.length === 0) {
        throw new Error(data.message || data.error || "Data API Threads kosong.");
      }
      const cleanDesc = decodeEntities(info.title || info.description || "");
      const lines = ["*THREADS DOWNLOADER*"];
      if (info.author) lines.push(`Author: ${info.author}`);
      if (cleanDesc) lines.push(`Deskripsi: ${cleanDesc}`);
      lines.push(`Total Media: ${mediaResults.length} file`);
      const captionText = lines.join("\n");
      const remoteJid = msg.key.remoteJid;
      // buffer fetch biar kebuka, jangan url langsung
      for (const item of mediaResults) {
        try {
          const buf = await request.buffer(item.url, { timeout: 25000, bypassCloudflare: "auto" });
          const mime = sniffMime(buf);
          if (mime.startsWith("image/")) {
            await sock.sendMessage(remoteJid, { image: buf, caption: mediaResults.length === 1 ? captionText : "" }, { quoted: msg });
          } else {
            const { ensureVideoCompatible } = await import("@/src/services/fetch/downloaderCompat.js");
            const vbuf = await ensureVideoCompatible(buf);
            await sock.sendMessage(remoteJid, { video: vbuf, mimetype: "video/mp4", caption: mediaResults.length === 1 ? captionText : "" }, { quoted: msg });
          }
        } catch (_) {
          if (item.type === "image") await sock.sendMessage(remoteJid, { image: { url: item.url } }, { quoted: msg });
          else await sock.sendMessage(remoteJid, { video: { url: item.url }, mimetype: "video/mp4" }, { quoted: msg });
        }
      }
      if (mediaResults.length > 1) await reply(captionText);
    } catch (err) {
      await reply(`Terjadi kesalahan saat mengunduh Threads: ${err.message}`);
    }
  },
};
