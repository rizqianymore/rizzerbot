import { request } from "@/src/utils/request.js";
import { brightDataRequest, isBrightDataEnabled } from "@/src/services/network/brightdata.js";

const BASE_URL = "https://www.socialdownloader.space";

const DEFAULT_HEADERS = {
  "content-type": "application/json",
  origin: BASE_URL,
  referer: `${BASE_URL}/`,
  "user-agent":
    "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
};

/**
 * Request scraping ke SocialDownloader dengan dukungan proteksi captcha / WAF:
 * Alur: Direct -> Cloudflare Stealth Bypass / Bright Data Web Unlocker
 */
export async function fetchSocialDownloader(url, opts = {}) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    throw new Error("URL media tidak valid");
  }

  const isAudio = opts.type === "audio" || opts.isAudio === true;
  const payload = {
    url: targetUrl,
    type: isAudio ? "audio" : "video",
    quality: opts.quality || "hd",
    format: isAudio ? "audio" : "video",
  };

  let data = null;

  // 1. Coba lewat Bright Data Web Unlocker jika API Key tersedia
  if (isBrightDataEnabled()) {
    try {
      data = await brightDataRequest(`${BASE_URL}/api/download`, {
        method: "POST",
        format: "json",
        headers: DEFAULT_HEADERS,
        data: payload,
        timeout: opts.timeout || 30000,
      });
    } catch (bdErr) {
      opts.logger?.warn?.(`[socialdownloader brightdata] ${bdErr?.message || bdErr}`);
    }
  }

  // 2. Fallback ke request bawaan dengan auto-bypass Cloudflare & captcha solver
  if (!data) {
    const response = await request.post(`${BASE_URL}/api/download`, payload, {
      headers: DEFAULT_HEADERS,
      timeout: opts.timeout || 35000,
      bypassCloudflare: "auto",
    });
    data = response?.data || response;
  }

  if (!data || data.success === false) {
    throw new Error(data?.error || "Gagal mengambil data dari SocialDownloader");
  }

  const metadata = data.metadata || {};
  let downloadUrl = data.downloadUrl || data.audioUrl || "";
  if (downloadUrl && downloadUrl.startsWith("/")) {
    downloadUrl = `${BASE_URL}${downloadUrl}`;
  }

  return {
    success: true,
    title: metadata.title || "",
    author: metadata.author || "",
    duration: Number(metadata.duration) || 0,
    thumbnail: metadata.thumbnail || "",
    platform: metadata.platform || "",
    isPhotoCarousel: Boolean(metadata.isPhotoCarousel),
    images: Array.isArray(metadata.images) ? metadata.images : [],
    downloadUrl,
    directVideoUrl: metadata.directVideoUrl || "",
    directAudioUrl: metadata.directAudioUrl || metadata.rawMusicUrl || "",
    embedUrl: metadata.embedUrl || "",
    raw: data,
  };
}

/**
 * Unduh buffer media dari SocialDownloader dengan proteksi captcha & stream safe
 */
export async function downloadSocialMedia(targetUrl, opts = {}) {
  const isAudio = opts.type === "audio" || opts.isAudio === true;
  const info = await fetchSocialDownloader(targetUrl, { ...opts, type: isAudio ? "audio" : "video" });

  const fetchUrl = isAudio
    ? info.downloadUrl || info.directAudioUrl
    : info.downloadUrl || info.directVideoUrl;

  if (!fetchUrl) {
    throw new Error("URL file media tidak ditemukan pada respon SocialDownloader");
  }

  const buffer = await request.buffer(fetchUrl, {
    headers: {
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      "user-agent": DEFAULT_HEADERS["user-agent"],
    },
    bypassCloudflare: "auto",
    timeout: opts.downloadTimeout || 45000,
  });

  if (!buffer || buffer.length === 0) {
    throw new Error("Buffer media kosong");
  }

  return {
    buffer: Buffer.from(buffer),
    info,
    isAudio,
    source: "socialdownloader",
  };
}
