import axios from "axios";
import {
  DEVICE_PROFILES,
  ACCEPT_LANGUAGES,
  getRandomDevice,
  buildScraperHeaders,
  request,
} from "@/src/utils/request.js";

export { DEVICE_PROFILES, ACCEPT_LANGUAGES, getRandomDevice, buildScraperHeaders, request };

const http = axios.create({
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const device = getRandomDevice();
  const defaultHeaders = buildScraperHeaders(device);

  config.headers = config.headers || {};
  for (const [key, value] of Object.entries(defaultHeaders)) {
    const lowerKey = key.toLowerCase();
    const hasHeader = Object.keys(config.headers).some(
      (h) => h.toLowerCase() === lowerKey
    );
    if (!hasHeader && value !== undefined && value !== null) {
      config.headers[key] = value;
    }
  }
  return config;
});

export async function fetchLyrics(artist, title) {
  const cleanArtist = String(artist || "").trim().slice(0, 100);
  const cleanTitle = String(title || "").trim().slice(0, 100);
  if (!cleanArtist || !cleanTitle) throw new Error("Artis dan judul lagu wajib diisi");
  const { data } = await http.get(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(
      cleanTitle
    )}`
  );
  if (!data?.lyrics?.trim) throw new Error("Lirik tidak ditemukan");
  return data.lyrics.trim();
}

export async function translateText(text, lang = "id") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Teks untuk diterjemahkan kosong");
  if (clean.length > 2000) throw new Error("Teks terlalu panjang (maksimal 2000 karakter)");
  const { data } = await http.get(
    "https://translate.googleapis.com/translate_a/single",
    {
      params: {
        client: "gtx",
        sl: "auto",
        tl: lang,
        dt: "t",
        q: clean,
      },
    }
  );
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
  const { data } = await http.get(
    "https://translate.google.com/translate_tts",
    {
      params: {
        ie: "UTF-8",
        client: "tw-ob",
        tl: lang,
        q: clean,
      },
      responseType: "arraybuffer",
    }
  );
  return Buffer.from(data);
}

export async function searchAnime(query) {
  const clean = String(query || "").trim().slice(0, 100);
  if (!clean) throw new Error("Kata kunci anime kosong");
  const { data } = await http.get("https://api.jikan.moe/v4/anime", {
    params: { q: clean, limit: 1 },
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

export async function webSearch(query) {
  const clean = String(query || "").trim().slice(0, 200);
  if (!clean) throw new Error("Kata kunci pencarian kosong");
  const { data } = await http.get(
    "https://api.duckduckgo.com/",
    {
      params: { q: clean, format: "json", no_html: 1 },
    }
  );
  const results = data?.RelatedTopics?.filter((t) => t.Text)
    .slice(0, 5)
    .map((t) => ({
      text: t.Text.slice(0, 150),
      url: t.FirstURL,
    }));
  if (!results?.length) {
    throw new Error("Mesin pencarian tidak mengembalikan hasil untuk kata kunci tersebut");
  }
  return results;
}

export async function tiktokDownload(url) {
  const ratingId = `snaptik_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const headers = {
    "authority": "snaptik.fi",
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json",
    "cookie": `snaptik_rating_id=${ratingId}`,
    "origin": "https://snaptik.fi",
    "priority": "u=1, i",
    "referer": "https://snaptik.fi/id/download-tiktok-video",
    "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data } = await http.post(
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

  // Fallback Bright Data Web Unlocker untuk TikTok jika request direct gagal/terblokir
  try {
    const { brightDataRequest, getBrightDataConfig } = await import("@/src/services/brightdata.js");
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

async function ytToolkitSession() {
  const device = getRandomDevice("mobile");
  const jar = {};
  const client = axios.create({ timeout: 35000, validateStatus: () => true });
  client.interceptors.request.use((cfg) => {
    const ck = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (ck) cfg.headers.Cookie = ck;
    return cfg;
  });
  client.interceptors.response.use((r) => {
    for (const c of r.headers["set-cookie"] || []) {
      const p = c.split(";")[0];
      const i = p.indexOf("=");
      const k = p.slice(0, i);
      if (k === "XSRF-TOKEN" || k === "youtubetoolkit-session") jar[k] = p.slice(i + 1);
    }
    return r;
  });

  const pageHeaders = buildScraperHeaders(device, {
    Referer: "https://www.google.com/",
  });
  const page = await client.get("https://youtubetoolkit.com/tools/video-downloader-1080p", {
    headers: pageHeaders,
  });
  const csrf = (String(page.data).match(/,"csrf":"([^"]+)"/) || [])[1];
  if (!csrf) throw new Error("Gagal mengambil token youtubetoolkit");

  const apiHeaders = buildScraperHeaders(device, {
    "Content-Type": "application/json",
    "X-CSRF-TOKEN": csrf,
    Origin: "https://youtubetoolkit.com",
    Referer: "https://youtubetoolkit.com/tools/video-downloader-1080p",
    Accept: "application/json, text/plain, */*",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  });

  return {
    client,
    headers: apiHeaders,
  };
}

export async function ytToolkitDownload(url, { type = "video", quality = "720" } = {}) {
  const { client, headers } = await ytToolkitSession();
  const analyze = await client.post(
    "https://youtubetoolkit.com/youtube-media-download/analyze",
    { url, download_api: "video_fast" },
    { headers }
  );
  const d = analyze.data?.data;
  if (!analyze.data?.success || !d) {
    throw new Error(analyze.data?.message || "Gagal menganalisis video");
  }

  const wantAudio = type === "audio";
  const options = wantAudio ? d.audio_options : d.video_options;
  let mode;
  if (wantAudio) {
    mode = options?.[0]?.mode;
  } else {
    mode = options?.find((o) => o.mode === `video:${quality}`)?.mode || d.default_mode;
  }
  const option = options?.find((o) => o.mode === mode);
  if (!option) throw new Error("Format tidak tersedia");

  const resolve = await client.post(
    "https://youtubetoolkit.com/youtube-media-download/resolve",
    {
      video_id: d.video_id,
      download_mode: mode,
      download_api: "video_fast",
      title: d.title,
      status_url: option.status_url,
    },
    { headers }
  );

  if (!resolve.data?.success) {
    if (resolve.data?.limit_reached) {
      throw new Error("Limit harian gratisan youtubetoolkit habis (1 video/hari).");
    }
    throw new Error(resolve.data?.message || "Gagal membuat link download");
  }

  const rd = resolve.data.data || {};
  return {
    title: d.title || "",
    channel: d.channel_title || "",
    duration: d.duration || "",
    durationSeconds: d.duration_seconds || 0,
    thumbnail: d.thumbnail || "",
    size: option.size || "",
    mode,
    url: rd.url || rd.download_url || rd.redirect || "",
    status: rd.status || "",
  };
}

export async function cobaltDownload(url, { mode = "auto", audioFormat = "mp3", videoQuality = "720" } = {}) {
  const device = getRandomDevice();
  const headers = buildScraperHeaders(device, {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://cobalt.tools",
    Referer: "https://cobalt.tools/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  });

  const apiKey = process.env.COBALT_API_KEY || "";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = {
    url,
    localProcessing: "preferred",
    videoQuality,
  };

  if (mode === "audio") {
    body.downloadMode = "audio";
    body.audioFormat = audioFormat;
  }

  try {
    const { data } = await http.post("https://api.cobalt.tools/", body, { headers });

    if (data.status === "error" || data.error) {
      throw new Error(data.text || data.error?.code || data.error || "Download gagal");
    }

    if (data.status === "picker" && Array.isArray(data.picker)) {
      const pickerUrl = data.picker[0]?.url;
      if (!pickerUrl) throw new Error("Pilih media gagal");
      return { type: "picker", picker: data.picker, url: pickerUrl, filename: data.filename || "" };
    }

    if (!data.url) {
      throw new Error(data.text || "Tidak ada URL hasil");
    }

    return { type: data.status || "tunnel", url: data.url, filename: data.filename || "", picker: data.picker };
  } catch (err) {
    const msg = err.response?.data?.error?.code || err.response?.data?.text || err.message;
    if (msg === "error.api.auth.jwt.missing" || msg === "error.api.auth.jwt.invalid" || err.response?.status === 403) {
      throw new Error(
        "Token Cobalt tidak valid/kedaluwarsa. Isi token terbaru di .env (COBALT_API_KEY)."
      );
    }
    if (err.response?.data?.text) {
      throw new Error(err.response.data.text);
    }
    throw err;
  }
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

export async function aiChat(prompt) {
  try {
    const { data } = await http.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
        },
      }
    );
    return data?.choices?.[0]?.message?.content || "Tidak ada jawaban";
  } catch (err) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const { data } = await http.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada jawaban";
    }
    throw new Error("API key AI tidak dikonfigurasi (.env OPENAI_API_KEY / GEMINI_API_KEY)");
  }
}
