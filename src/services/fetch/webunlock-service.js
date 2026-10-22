import { request } from "@/src/utils/request.js";
import { fetchViaUnlocker, getBrightDataConfig } from "@/src/services/network/brightdata.js";
import { stealthBrowser } from "@/src/utils/request/browser.js";
import { detectProtection, isSolvableType } from "@/src/utils/request/protection.js";

const BASE_URL = "https://www.socialdownloader.space";

const DEFAULT_HEADERS = {
  "content-type": "application/json",
  origin: BASE_URL,
  referer: `${BASE_URL}/`,
  "user-agent":
    "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
};

/**
 * Download media dari sosial media dengan penanganan proteksi otomatis.
 * Alur: SocialDownloader API -> BrightData Unlocker -> Browser Stealth -> yt-dlp fallback
 * 
 * @param {string} targetUrl - URL media sosial
 * @param {object} opts - Opsi: type (audio/video), downloadTimeout
 * @returns {Promise} - { buffer, info, isAudio, source }
 */
export async function downloadMediaWithProtectionHandling(targetUrl, opts = {}) {
  const isAudio = opts.type === "audio" || opts.isAudio === true;
  const url = String(targetUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("URL media tidak valid");
  }

  // === Langkah 1: Coba SocialDownloader API ===
  try {
    const info = await fetchSocialDownloader(url, { ...opts, type: isAudio ? "audio" : "video" });

    const fetchUrl = isAudio
      ? info.downloadUrl || info.directAudioUrl
      : info.downloadUrl || info.directVideoUrl;

    if (fetchUrl) {
      // Cek apakah URL butuh proteksi
      const protectionCheck = await checkProtection(fetchUrl);
      if (!protectionCheck.hasProtection) {
        const buffer = await request.buffer(fetchUrl, {
          headers: {
            origin: BASE_URL,
            referer: `${BASE_URL}/`,
            "user-agent": DEFAULT_HEADERS["user-agent"],
          },
          timeout: opts.downloadTimeout || 40000,
        });

        if (buffer && buffer.length > 0) {
          return {
            buffer: Buffer.from(buffer),
            info,
            isAudio,
            source: "socialdownloader",
          };
        }
      }
    }
  } catch (sdlErr) {
    // SocialDownloader gagal, lanjut ke langkah selanjutnya
  }

  // === Langkah 2: Coba BrightData Unlocker (web unclocker) ===
  // Selalu dicoba; kalau BRIGHTDATA_API_KEY tidak di-set, error akan ditebak
  // dan sistem akan melanjutkan ke langkah browser stealth secara otomatis
  try {
    const bdRes = await fetchViaUnlocker(url, {
      format: "json",
      method: "POST",
      data: { url },
      timeout: 30000,
    });

      if (bdRes && bdRes.download_link) {
        const author = bdRes.author || {};
        const result = {
          title: bdRes.title || bdRes.description || "",
          author: author.nickname || author.uniqueId || "",
          uniqueId: author.uniqueId || "",
          playCount: bdRes.statistics?.play_count || 0,
          diggCount: bdRes.statistics?.digg_count || 0,
          duration: bdRes.duration || 0,
          cover: bdRes.cover || "",
          mp3: bdRes.download_link.mp3 || "",
          noWatermark: bdRes.download_link.no_watermark || "",
          watermark: bdRes.download_link.watermark || "",
        };

        // Coba fetch buffer dari link yang didapat
        if (result.noWatermark) {
          const buffer = await request.buffer(result.noWatermark, {
            headers: {
              origin: "https://snaptik.fi",
              referer: "https://snaptik.fi/id/download-tiktok-video",
              "user-agent":
                "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
            },
            timeout: 40000,
          });

          if (buffer && buffer.length > 0) {
            return {
              buffer: Buffer.from(buffer),
              info: {
                title: result.title,
                author: result.author,
                duration: result.duration,
                platform: "brightdata-unlocker",
              },
              isAudio: opts.type === "audio" || opts.isAudio === true,
              source: "brightdata-unlocker",
            };
          }
        }
      }
    } catch (bdErr) {
      // Jika BRIGHTDATA_API_KEY belum di-set atau error, diam-lanjutkan
      // ke langkah browser stealth secara otomatis. Error ini akan di-ignore
      // dan sistem akan melangkah ke langkah selanjutnya.
    }
  }

  // === Langkah 3: Coba Browser Stealth ===
  try {
    const { browser, close } = await stealthBrowser.getBrowser();
    const page = await browser.newPage();

    // Navigasi ke URL dengan bypass challenge
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Cek danatasi proteksi
    const { type: protType, cleared } = await stealthBrowser.waitForClearance(page, {
      timeoutMs: 25000,
      clickCheckbox: true,
    });

    if (cleared) {
      // Ambil halaman setelah clearance
      const content = await page.content();
      const mediaUrls = extractMediaUrls(content, url);

      if (mediaUrls && mediaUrls.length > 0) {
        // Ambil buffer dari URL pertama yang valid
        const firstUrl = mediaUrls[0];
        try {
          const buffer = await request.buffer(firstUrl, {
            headers: {
              origin: new URL(url).origin,
              referer: url,
              "user-agent": DEFAULT_HEADERS["user-agent"],
            },
            timeout: 40000,
          });

          if (buffer && buffer.length > 0) {
            await close();
            return {
              buffer: Buffer.from(buffer),
              info: {
                title: "Downloaded via browser",
                platform: protType || "browser",
              },
              isAudio: opts.type === "audio" || opts.isAudio === true,
              source: "browser-stealth",
            };
          }
        } catch (bufferErr) {
          // lanjut
        }
      }
    }

    await close();
  } catch (browserErr) {
    // logger?.warn?.(`[webunlock browser] ${browserErr?.message || browserErr}`);
  }

  // === Langkah 4: Lempar error untuk fallback ke yt-dlp ===
  throw new Error("Semua metode unduh gagal, mencoba yt-dlp sebagai fallback...");
}

/**
 * Cek apakah URL butuh proteksi berdasarkan header/respons
 */
async function checkProtection(url) {
  try {
    const res = await request.text(url, { timeout: 10000 });
    const det = detectProtection({
      status: 0,
      headers: {},
      html: res,
      title: "",
      url,
    });

    return {
      hasProtection: isSolvableType(det.type) || det.type !== "none",
      type: det.type,
    };
  } catch (e) {
    return { hasProtection: true, type: "error" };
  }
}

/**
 * Ekstraksi URL media dari konten HTML
 */
function extractMediaUrls(html, baseUrl) {
  const urls = [];
  // Cari pattern URL media umum
  const matches = html.match(/["'](https?:\/\/[^"']+\.(?:mp4|webm|mp3|m4a))["']/gi);
  if (matches) {
    for (const m of matches) {
      const url = m.replace(/["']/g, "");
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/**
 * Fetch SocialDownloader API
 */
async function fetchSocialDownloader(url, opts = {}) {
  const isAudio = opts.type === "audio" || opts.isAudio === true;
  const targetUrl = String(url || "").trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    throw new Error("URL media tidak valid");
  }

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