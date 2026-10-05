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
            const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/brightdata.js");
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
                  media: items.map(it => ({
                    type: it.type === "mp4" ? "mp4" : "image",
                    url: it.url?.[0]?.url || it.url,
                  })).filter(m => m.url),
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
          if (item.buffer && Buffer.isBuffer(item.buffer)) {
            if (item.type === "mp4") videos.push({ buffer: item.buffer });
            else images.push({ buffer: item.buffer });
            continue;
          }
          const mediaUrl = clean(item.url || item.video || item.image || item.thumbnail || "");
          if (!mediaUrl) continue;
          const isVideo =
            item.type === "mp4" ||
            /\.mp4(\?|$)/i.test(mediaUrl) ||
            Boolean(item.video);
          if (isVideo) videos.push({ url: mediaUrl });
          else images.push({ url: mediaUrl });
        }

        async function toBuffer(src) {
          if (src.buffer) return src.buffer;
          const r = await fetch(src.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
              Referer: "https://www.instagram.com/",
            },
            signal: AbortSignal.timeout(20000),
          });
          if (!r.ok) throw new Error(`Fetch media HTTP ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        }

        async function sendImage(target, cap) {
          try {
            let buf = await toBuffer(target);
            // WhatsApp image message tidak selalu mau terima webp langsung — konversi ke jpeg.
            const isWebp =
              buf.length > 12 &&
              buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
              buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
            if (isWebp) {
              try {
                const { default: sharp } = await import("sharp");
                buf = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
              } catch (_) {}
            }
            await sock.sendMessage(remoteJid, { image: buf, caption: cap }, { quoted: msg });
          } catch (_) {
            if (target.url) {
              await sock.sendMessage(remoteJid, { image: { url: target.url }, caption: cap }, { quoted: msg });
            } else {
              throw new Error("Gagal mengambil gambar Instagram.");
            }
          }
        }

        async function sendVideo(target, cap) {
          try {
            const buf = await toBuffer(target);
            await sock.sendMessage(
              remoteJid,
              { video: buf, caption: cap, mimetype: "video/mp4" },
              { quoted: msg }
            );
          } catch (_) {
            if (target.url) {
              await sock.sendMessage(
                remoteJid,
                { video: { url: target.url }, caption: cap, mimetype: "video/mp4" },
                { quoted: msg }
              );
            } else {
              throw new Error("Gagal mengambil video Instagram.");
            }
          }
        }

        if (images.length === 1 && videos.length === 0) {
          await sendImage(images[0], caption);
        } else if (images.length > 1 && videos.length === 0) {
          for (let i = 0; i < images.length; i++) {
            await sendImage(images[i], i === 0 ? caption : "");
          }
        }

        for (let i = 0; i < videos.length; i++) {
          await sendVideo(videos[i], images.length === 0 && i === 0 ? caption : "");
        }

        await react("✅");
      } catch (e) {
        logger?.warn?.(`[igdl] ${e?.message || e}`);
        await react("❌");
        return reply(`❌ Gagal mengunduh Instagram: ${e?.message || "Media tidak ditemukan atau akun privat."}`);
      }
    },
};
