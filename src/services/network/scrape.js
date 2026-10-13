import {
  DEVICE_PROFILES,
  ACCEPT_LANGUAGES,
  getRandomDevice,
  buildScraperHeaders,
  request,
} from "@/src/utils/request.js";

export { DEVICE_PROFILES, ACCEPT_LANGUAGES, getRandomDevice, buildScraperHeaders, request };

export async function fetchLyrics(artist, title) {
  const cleanArtist = String(artist || "")
    .trim()
    .slice(0, 100);
  const cleanTitle = String(title || "")
    .trim()
    .slice(0, 100);
  if (!cleanArtist || !cleanTitle) throw new Error("Artis dan judul lagu wajib diisi");
  const data = await request.json(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`,
    { timeout: 20000 }
  );
  if (!data?.lyrics?.trim?.()) throw new Error("Lirik tidak ditemukan");
  return String(data.lyrics).trim();
}

export async function translateText(text, lang = "id") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Teks untuk diterjemahkan kosong");
  if (clean.length > 2000) throw new Error("Teks terlalu panjang (maksimal 2000 karakter)");
  const data = await request.json("https://translate.googleapis.com/translate_a/single", {
    params: {
      client: "gtx",
      sl: "auto",
      tl: lang,
      dt: "t",
      q: clean,
    },
    timeout: 20000,
    via: "brightdata",
  });
  const segments = Array.isArray(data?.[0]) ? data[0] : null;
  const translated = segments?.map((seg) => seg?.[0]).join("");
  if (!translated) throw new Error("Terjemahan gagal");
  return {
    original: clean,
    translated,
    lang: data?.[2],
  };
}

export async function textToSpeech(text, lang = "id-ID") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Teks untuk TTS kosong");
  if (clean.length > 300) throw new Error("Teks terlalu panjang untuk TTS (maksimal 300 karakter)");
  const data = await request.buffer("https://translate.google.com/translate_tts", {
    params: {
      ie: "UTF-8",
      client: "tw-ob",
      tl: lang,
      q: clean,
    },
    timeout: 20000,
    via: "brightdata",
  });
  return Buffer.from(data);
}

export async function searchAnime(query) {
  const clean = String(query || "")
    .trim()
    .slice(0, 100);
  if (!clean) throw new Error("Kata kunci anime kosong");
  const data = await request.json("https://api.jikan.moe/v4/anime", {
    params: { q: clean, limit: 1 },
    timeout: 20000,
  });
  const anime = data?.data?.[0];
  if (!anime) throw new Error("Anime tidak ditemukan");
  return {
    title: anime.title,
    titleJp: anime.title_japanese,
    type: anime.type,
    episodes: anime.episodes,
    status: anime.status,
    score: anime.score,
    genres: anime.genres?.map((g) => g.name).join(", ") || "-",
    synopsis: anime.synopsis?.slice(0, 500),
    url: anime.url,
    image: anime.images?.jpg?.large_image_url,
  };
}

export async function tiktokDownload(url) {
  const ratingId = `snaptik_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const headers = {
    authority: "snaptik.fi",
    accept: "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json",
    cookie: `snaptik_rating_id=${ratingId}`,
    origin: "https://snaptik.fi",
    priority: "u=1, i",
    referer: "https://snaptik.fi/id/download-tiktok-video",
    "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data = await request.post(
        "https://snaptik.fi/api/tiktok",
        { url: url.trim() },
        { headers, timeout: 25000 }
      );

      if (!data?.download_link) {
        throw new Error(data?.message || data?.error || "Video TikTok tidak ditemukan atau diproteksi.");
      }

      const author = data.author || {};
      return {
        title: data.title || data.description || "",
        author: author.nickname || author.uniqueId || "",
        uniqueId: author.uniqueId || "",
        playCount: data.statistics?.play_count || 0,
        diggCount: data.statistics?.digg_count || 0,
        duration: data.duration || 0,
        cover: data.cover || "",
        mp3: data.download_link.mp3 || "",
        noWatermark: data.download_link.no_watermark || "",
        watermark: data.download_link.watermark || "",
      };
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  try {
    const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/network/brightdata.js");
    if (getBrightDataConfig().apiKey) {
      const bdRes = await brightDataRequest("https://snaptik.fi/api/tiktok", {
        format: "json",
        method: "POST",
        headers,
        data: { url: url.trim() },
        timeout: 30000,
      });

      if (bdRes?.download_link) {
        const author = bdRes.author || {};
        return {
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
      }
    }
  } catch (_) {}

  throw new Error(lastError?.response?.data?.error || lastError?.message || "Gagal mengambil data TikTok");
}

export async function fetchBuffer(url, customHeaders = {}) {
  if (!/^https?:\/\//i.test(String(url || ""))) {
    throw new Error("URL tidak valid (harus http/https)");
  }
  return await request.buffer(url, {
    headers: customHeaders,
    bypassCloudflare: "auto",
  });
}
