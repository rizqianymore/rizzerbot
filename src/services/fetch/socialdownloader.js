import { request } from "@/src/utils/request.js";

const BASE_URL = "https://www.socialdownloader.space";

const DEFAULT_HEADERS = {
  "content-type": "application/json",
  origin: BASE_URL,
  referer: `${BASE_URL}/`,
  "user-agent":
    "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
};

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

  const response = await request.post(`${BASE_URL}/api/download`, payload, {
    headers: DEFAULT_HEADERS,
    timeout: opts.timeout || 25000,
  });

  const data = response?.data || response;
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
 * Download buffer media langsung melalui stream proxy / direct url SocialDownloader.
 * @param {string} targetUrl - URL target media sosial
 * @param {object} opts
 * @returns {Promise<{buffer: Buffer, info: object, isAudio: boolean}>}
 */
export async function downloadSocialMedia(targetUrl, opts = {}) {
  const isAudio = opts.type === "audio" || opts.isAudio === true;
  const info = await fetchSocialDownloader(targetUrl, { ...opts, type: isAudio ? "audio" : "video" });

  // Prioritaskan directVideoUrl atau proxy downloadUrl
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
    timeout: opts.downloadTimeout || 40000,
  });

  if (!buffer || buffer.length === 0) {
    throw new Error("Buffer media yang diunduh dari SocialDownloader kosong");
  }

  return {
    buffer: Buffer.from(buffer),
    info,
    isAudio,
  };
}
