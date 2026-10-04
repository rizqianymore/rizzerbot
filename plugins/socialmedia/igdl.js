function clean(s) {
  return String(s || "").trim();
}

function cleanText(text = "") {
  return String(text || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function downloadFromKolId(targetUrl) {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  const pageRes = await fetch("https://kol.id/download-video/instagram", {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!pageRes.ok) throw new Error(`Kol.id page returned ${pageRes.status}`);

  const html = await pageRes.text();
  const setCookies = pageRes.headers.getSetCookie
    ? pageRes.headers.getSetCookie()
    : [pageRes.headers.get("set-cookie")];
  const cookieHeader = (setCookies || [])
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
  const token = (html.match(/name="_token"\s+value="([^"]+)"/) || [])[1];

  if (!token) throw new Error("Gagal mengambil token CSRF dari kol.id");

  const postRes = await fetch("https://kol.id/api/v2/downloader/instagram", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      cookie: cookieHeader,
      origin: "https://kol.id",
      referer: "https://kol.id/download-video/instagram",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      url: targetUrl,
      _token: token,
    }).toString(),
    signal: AbortSignal.timeout(15000),
  });

  const postData = await postRes.json();
  let resultData = postData?.data;

  if (postData?.meta?.status === "accepted" && resultData?.request_id) {
    const reqId = resultData.request_id;
    const pollInterval = (resultData.poll_after || 4) * 1000;

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const pollRes = await fetch(
        `https://kol.id/api/v2/downloader/status/${reqId}`,
        {
          headers: {
            ...headers,
            cookie: cookieHeader,
            referer: "https://kol.id/download-video/instagram",
            "x-requested-with": "XMLHttpRequest",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (
        pollData?.meta?.status === "ok" ||
        pollData?.data?.status === "completed"
      ) {
        resultData = pollData.data;
        break;
      }
      if (
        pollData?.meta?.status === "failed" ||
        pollData?.data?.status === "failed"
      ) {
        throw new Error(pollData?.meta?.message || "Kol.id parsing gagal.");
      }
    }
  }

  if (!resultData) return null;

  const mediaItems = [];
  if (Array.isArray(resultData.slides) && resultData.slides.length > 0) {
    for (const slide of resultData.slides) {
      const mediaUrl = slide.url || slide.thumbnail;
      if (!mediaUrl) continue;
      mediaItems.push({
        type: slide.type === "video" ? "mp4" : "image",
        url: mediaUrl,
      });
    }
  } else if (resultData.video_url) {
    mediaItems.push({
      type: "mp4",
      url: resultData.video_url,
    });
  } else if (resultData.thumbnail) {
    mediaItems.push({
      type: "image",
      url: resultData.thumbnail,
    });
  }

  if (!mediaItems.length) return null;

  return {
    username: resultData.author || "",
    likes: 0,
    title: resultData.title || "",
    media: mediaItems,
  };
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

        // Fallback terakhir: gunakan yt-dlp engine (Yoinks logic) jika API/scraper web gagal
        if (!res || !res.media?.length) {
          try {
            const { downloadMedia, probe } = await import("@/src/services/ytdlp.js");
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
