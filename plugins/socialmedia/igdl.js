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

        // 2. Coba FastDL payload convert
        if (!res) {
          try {
            const fdlRes = await fetch("https://api-wh.fastdl.app/api/convert", {
              method: "POST",
              headers: {
                "authority": "api-wh.fastdl.app",
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "origin": "https://fastdl.app",
                "referer": "https://fastdl.app/",
                "user-agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
              },
              body: JSON.stringify({
                target_url: input,
                ts: Date.now(),
                _ts: 1790674194069,
                _tsc: 0,
                _sv: 2,
                _s: "2e221d3e6f9488bfa88c64cbdacc8ea5957a8e2809699f3f355a27a1109522af"
              }),
              signal: AbortSignal.timeout(15000),
            });
            if (fdlRes.ok) {
              const fdlData = await fdlRes.json();
              if (Array.isArray(fdlData) && fdlData.length > 0) {
                const mediaItems = [];
                for (const item of fdlData) {
                  const u = item.url?.[0]?.url;
                  const type = item.url?.[0]?.type || "jpg";
                  if (u) mediaItems.push({ type: type === "mp4" ? "mp4" : "image", url: u });
                }
                if (mediaItems.length > 0) {
                  res = {
                    username: fdlData[0]?.meta?.username || "",
                    likes: 0,
                    title: fdlData[0]?.meta?.title || "",
                    media: mediaItems,
                  };
                }
              }
            }
          } catch (_) {}
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
          if (item.type === "mp4" || item.url?.includes(".mp4") || item.video) {
            videos.push(item.url || item.video);
          } else {
            images.push(item.url || item.image);
          }
        }

        if (images.length === 1 && videos.length === 0) {
          await sock.sendMessage(
            remoteJid,
            { image: { url: images[0] }, caption },
            { quoted: msg }
          );
        } else if (images.length > 1) {
          try {
            await sock.sendMessage(
              remoteJid,
              {
                album: images.map((url, i) => ({
                  image: { url },
                  caption: i === 0 ? caption : "",
                })),
              },
              { quoted: msg }
            );
          } catch (_) {
            for (let i = 0; i < images.length; i++) {
              await sock.sendMessage(
                remoteJid,
                { image: { url: images[i] }, caption: i === 0 ? caption : "" },
                { quoted: msg }
              );
            }
          }
        }

        for (let i = 0; i < videos.length; i++) {
          await sock.sendMessage(
            remoteJid,
            {
              video: { url: videos[i] },
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
