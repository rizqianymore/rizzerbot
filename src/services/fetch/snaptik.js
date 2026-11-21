import { ProxyAgent, fetch } from "undici";
import { getBrightDataProxy } from "../network/brightdata.js";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SNAPTIK_HEADERS = {
  Referer: "https://snaptik.fi/",
  "User-Agent": DEFAULT_UA,
};

let proxyAgentInstance = null;

function getUnlockerAgent() {
  if (proxyAgentInstance) return proxyAgentInstance;
  const proxyUrl = getBrightDataProxy();
  if (proxyUrl) {
    proxyAgentInstance = new ProxyAgent({
      uri: proxyUrl,
      requestTls: { rejectUnauthorized: false },
    });
  }
  return proxyAgentInstance;
}

async function fetchMediaBuffer(dlLink) {

  try {
    const res = await fetch(dlLink, { headers: SNAPTIK_HEADERS });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > 1000) {
        return Buffer.from(arrayBuf);
      }
    }
  } catch (_) {}

  const agent = getUnlockerAgent();
  const res = await fetch(dlLink, {
    headers: SNAPTIK_HEADERS,
    dispatcher: agent,
  });

  if (!res.ok) {
    throw new Error(`Gagal download stream video (HTTP ${res.status})`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function downloadViaSnaptik(url, { isAudio = false } = {}) {
  const tiktokUrl = String(url || "").trim();
  if (!tiktokUrl) throw new Error("URL TikTok tidak boleh kosong.");

  const agent = getUnlockerAgent();
  const fetchOpts = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://snaptik.fi",
      Referer: "https://snaptik.fi/en/download-tiktok-video",
      "User-Agent": DEFAULT_UA,
    },
    body: JSON.stringify({ url: tiktokUrl }),
    ...(agent ? { dispatcher: agent } : {}),
  };

  try {
    const apiRes = await fetch("https://snaptik.fi/api/tiktok", fetchOpts);

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && !data.error) {
        const dlLink = isAudio
          ? data.download_link?.mp3 || data.audio
          : data.download_link?.no_watermark || data.download_link?.mp4 || data.audio;

        if (dlLink) {
          const buffer = await fetchMediaBuffer(dlLink);
          if (buffer && buffer.length > 1000) {
            return {
              buffer,
              info: {
                title: data.title || data.description || "TikTok Video",
                uploader: data.author?.nickname || data.author?.uniqueId || data.artist || "",
                duration: Number(data.duration) || Number(data.music_duration) || 0,
                thumbnail: data.cover || data.dynamic_cover || "",
              },
              source: "snaptik-unlocker",
            };
          }
        }
      }
    }
  } catch (_) {}

  try {
    const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
    const tikRes = await fetch(tikwmUrl, {
      method: "GET",
      headers: {
        "User-Agent": DEFAULT_UA,
      },
      ...(agent ? { dispatcher: agent } : {}),
    });

    if (tikRes.ok) {
      const body = await tikRes.json();
      if (body && body.code === 0 && body.data) {
        const d = body.data;
        const targetDl = isAudio ? d.music : d.play || d.wmplay || d.music;

        if (Array.isArray(d.images) && d.images.length > 0) {
          const imageUrls = d.images.map((img) => (img.startsWith("http") ? img : `https://www.tikwm.com${img}`));
          return {
            buffer: null,
            images: imageUrls,
            isSlide: true,
            info: {
              title: d.title || "TikTok Slide",
              uploader: d.author?.nickname || d.author?.unique_id || "",
              duration: 0,
              thumbnail: d.cover || imageUrls[0] || "",
            },
            source: "tikwm-slide",
          };
        }

        if (targetDl) {
          const dlUrl = targetDl.startsWith("http") ? targetDl : `https://www.tikwm.com${targetDl}`;
          const buffer = await fetchMediaBuffer(dlUrl);

          if (buffer && buffer.length > 1000) {
            return {
              buffer,
              info: {
                title: d.title || "TikTok Video",
                uploader: d.author?.nickname || d.author?.unique_id || "",
                duration: Number(d.duration) || 0,
                thumbnail: d.cover || "",
              },
              source: "tikwm-unlocker",
            };
          }
        }
      }
    }
  } catch (err) {
    throw new Error(`Gagal mengunduh media TikTok via Web Unlocker: ${err.message || err}`);
  }

  throw new Error("Gagal mengambil media TikTok via Web Unlocker (video mungkin privat atau link tidak valid).");
}
