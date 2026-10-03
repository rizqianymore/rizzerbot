// plugins/socialmedia/igdl.js — mandiri: 1 file = 1 perintah (helper digabung langsung).

function clean(s) {
  return String(s || "").trim();
}

function cleanText(text = "") {
  return String(text || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  "name": "igdl",
  "aliases": ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  "description": "Download video/foto Instagram",
  "usage": "<url>",
  "premiumOnly": true,
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
      const remoteJid = msg.key.remoteJid;
      const currentPrefix = prefix || ".";
      const react = (emoji) =>
        sock.sendMessage(remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

      const input = clean(args.join(" ") || args?.[0]);

      if (!input) {
        return reply(`Contoh:\n${currentPrefix}igdl https://instagram.com/...`);
      }

      await react("✨");
      await sendTyping();

      try {
        let res = null;
        // 1. Coba NexRay V2
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

        // 2. Coba FastDL via stealth browser
        if (!res) {
          try {
            const { stealthBrowser } = await import("@/src/utils/request.js");
            const browser = await stealthBrowser.getBrowser();
            const page = await browser.newPage();
            try {
              let captured = null;
              page.on("response", async (response) => {
                if (response.url().includes("/api/convert")) {
                  try { captured = await response.json(); } catch (_) {}
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
          const payload = item.buffer ? item.buffer : { url: item.url || item.video || item.image };
          if (item.type === "mp4" || item.url?.includes(".mp4") || item.video) {
            videos.push(payload);
          } else {
            images.push(payload);
          }
        }

        if (images.length === 1 && videos.length === 0) {
          const imgPayload = Buffer.isBuffer(images[0]) ? { image: images[0] } : images[0];
          await sock.sendMessage(
            remoteJid,
            { ...imgPayload, caption },
            { quoted: msg }
          );
        } else if (images.length > 1) {
          for (let i = 0; i < images.length; i++) {
            const imgPayload = Buffer.isBuffer(images[i]) ? { image: images[i] } : images[i];
            await sock.sendMessage(
              remoteJid,
              { ...imgPayload, caption: i === 0 ? caption : "" },
              { quoted: msg }
            );
          }
        }

        for (let i = 0; i < videos.length; i++) {
          const vidPayload = Buffer.isBuffer(videos[i]) ? { video: videos[i] } : videos[i];
          await sock.sendMessage(
            remoteJid,
            {
              ...vidPayload,
              caption: images.length === 0 && i === 0 ? caption : "",
              mimetype: "video/mp4",
            },
            { quoted: msg }
          );
        }

        await react("✅");
      } catch (e) {
        logger?.warn?.(`[igdl] ${e?.message || e}`);
        await react("❌");
        return reply(`❌ Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
      }
    },
};
