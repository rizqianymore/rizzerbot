import { clean, cleanText } from "@/src/services/fetch/igdl/utils.js";
import { downloadFromKolId } from "@/src/services/fetch/igdl/providers.js";
import { sendImage, sendVideo } from "@/src/services/fetch/igdl/sender.js";

export default {
  name: "igdl",
  aliases: ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  description: "Download video/foto Instagram",
  usage: "<url>",
  premiumOnly: true,
  category: "Social Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const remoteJid = msg.key.remoteJid;
    const currentPrefix = prefix || ".";
    const react = (emoji) => sock.sendMessage(remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

    const input = clean(args.join(" ") || args?.[0]);

    if (!input) {
      return reply(`Contoh:\n${currentPrefix}igdl https://instagram.com/...`);
    }

    await react("✨");
    await sendTyping();

    try {
      let res = null;

      // 1. Coba provider kol.id (sesuai request.txt)
      try {
        res = await downloadFromKolId(input);
      } catch (kolErr) {
        logger?.warn?.(`[igdl kol.id] ${kolErr?.message || kolErr}`);
      }

      // 2. Fallback Nexray API
      if (!res) {
        try {
          const resApi = await fetch(
            `https://api.nexray.eu.cc/downloader/v2/instagram?url=${encodeURIComponent(input)}`,
            { signal: AbortSignal.timeout(15000) }
          );
          if (resApi.ok) {
            const data = await resApi.json();
            if (data.status && data.result?.media?.length) {
              res = data.result;
            }
          }
        } catch (_) {}
      }

      if (!res) {
        try {
          const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/network/brightdata.js");
          if (getBrightDataConfig().apiKey) {
            const bdRes = await brightDataRequest("https://fastdl.app/c/", {
              format: "json",
              method: "POST",
              headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
              data: `url=${encodeURIComponent(input)}`,
            });
            if (bdRes && (Array.isArray(bdRes) || bdRes.url)) {
              const items = Array.isArray(bdRes) ? bdRes : [bdRes];
              res = {
                username: "",
                likes: 0,
                title: "",
                media: items
                  .map((it) => ({
                    type: it.type === "mp4" ? "mp4" : "image",
                    url: it.url?.[0]?.url || it.url,
                  }))
                  .filter((m) => m.url),
              };
            }
          }
        } catch (bdErr) {
          logger?.warn?.(`[igdl brightdata] ${bdErr?.message || bdErr}`);
        }
      }

      if (!res) {
        try {
          const { stealthBrowser } = await import("@/src/utils/request.js");
          const browser = await stealthBrowser.getBrowser();
          const page = await browser.newPage();
          try {
            let captured = null;
            page.on("response", async (response) => {
              if (response.url().includes("/api/convert")) {
                try {
                  captured = await response.json();
                } catch (_) {}
              }
            });

            await page.goto("https://fastdl.app/en", { waitUntil: "domcontentloaded", timeout: 20000 });
            await page.waitForSelector("#search-form-input", { timeout: 10000 });
            await page.type("#search-form-input", input);
            await page.click("button.search-form__button");

            for (let i = 0; i < 25; i++) {
              if (captured) break;
              await new Promise((r) => setTimeout(r, 400));
            }

            if (Array.isArray(captured) && captured.length > 0) {
              const mediaItems = [];
              for (const item of captured) {
                const dlUrl = item.url?.[0]?.url;
                const type = item.url?.[0]?.type || "jpg";
                if (!dlUrl) continue;

                const b64 = await page.evaluate(async (url) => {
                  const resp = await window.fetch(url);
                  const blob = await resp.blob();
                  return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                  });
                }, dlUrl);

                const commaIdx = b64.indexOf(",");
                const buffer = Buffer.from(b64.slice(commaIdx + 1), "base64");
                mediaItems.push({
                  type: type === "mp4" ? "mp4" : "image",
                  buffer,
                });
              }

              if (mediaItems.length > 0) {
                res = {
                  username: captured[0]?.meta?.username || "",
                  likes: 0,
                  title: captured[0]?.meta?.title || "",
                  media: mediaItems,
                };
              }
            }
          } finally {
            await page.close().catch(() => {});
          }
        } catch (fastdlErr) {
          logger?.warn?.(`[igdl fastdl fallback] ${fastdlErr?.message || fastdlErr}`);
        }
      }

      // Fallback terakhir: gunakan yt-dlp engine (Yoinks logic) jika API/scraper web gagal
      if (!res || !res.media?.length) {
        try {
          const { downloadMedia, probe } = await import("@/src/services/fetch/ytdlp.js");
          const info = await probe(input).catch(() => null);
          const dl = await downloadMedia(input, { mode: "video" });
          if (dl?.buffer) {
            res = {
              username: info?.uploader || "",
              likes: 0,
              title: info?.title || "",
              media: [{ type: "mp4", buffer: dl.buffer }],
            };
          }
        } catch (ytdlpErr) {
          logger?.warn?.(`[igdl ytdlp fallback] ${ytdlpErr?.message || ytdlpErr}`);
        }
      }

      if (!res || !res.media?.length) {
        throw new Error("Media tidak ditemukan atau akun di-private.");
      }

      const lines = ["*INSTAGRAM DOWNLOADER*"];
      if (res.username) lines.push(`Author: ${cleanText(res.username)}`);
      if (res.likes) lines.push(`Likes: ${res.likes.toLocaleString()}`);
      if (res.title) lines.push(`Judul: ${cleanText(res.title)}`);
      const caption = lines.join("\n");

      const images = [];
      const videos = [];

      for (const item of res.media) {
        if (item.buffer && Buffer.isBuffer(item.buffer)) {
          if (item.type === "mp4") videos.push({ buffer: item.buffer });
          else images.push({ buffer: item.buffer });
          continue;
        }
        const mediaUrl = clean(item.url || item.video || item.image || item.thumbnail || "");
        if (!mediaUrl) continue;
        const isVideo = item.type === "mp4" || /\.mp4(\?|$)/i.test(mediaUrl) || Boolean(item.video);
        if (isVideo) videos.push({ url: mediaUrl });
        else images.push({ url: mediaUrl });
      }

      if (images.length === 1 && videos.length === 0) {
        await sendImage(sock, remoteJid, msg, images[0], caption);
      } else if (images.length > 1 && videos.length === 0) {
        for (let i = 0; i < images.length; i++) {
          await sendImage(sock, remoteJid, msg, images[i], i === 0 ? caption : "");
        }
      }

      for (let i = 0; i < videos.length; i++) {
        await sendVideo(sock, remoteJid, msg, videos[i], images.length === 0 && i === 0 ? caption : "");
      }

      await react("✅");
    } catch (e) {
      logger?.warn?.(`[igdl] ${e?.message || e}`);
      await react("❌");
      return reply(`❌ Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
    }
  },
};
