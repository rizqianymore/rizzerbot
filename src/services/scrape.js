import axios from "axios";

/**
 * Dynamic Device Profiles for realistic anti-bot / anti-scraping bypass.
 * Covers modern Android, iOS, Windows, macOS, and Linux devices.
 */
export const DEVICE_PROFILES = [
  {
    name: "Samsung Galaxy S24 Ultra",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 915, isMobile: true, hasTouch: true },
  },
  {
    name: "Samsung Galaxy A55",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.125 Mobile Safari/537.36",
    secChUa: '"Chromium";v="133", "Google Chrome";v="133", "Not?A_Brand";v="99"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 892, isMobile: true, hasTouch: true },
  },
  {
    name: "Google Pixel 8 Pro",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 412, height: 892, isMobile: true, hasTouch: true },
  },
  {
    name: "Xiaomi 14 Pro",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.39 Mobile Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
    viewport: { width: 393, height: 873, isMobile: true, hasTouch: true },
  },
  {
    name: "iPhone 16 Pro Max",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    secChUa: null,
    secChUaMobile: "?1",
    secChUaPlatform: '"iOS"',
    viewport: { width: 440, height: 956, isMobile: true, hasTouch: true },
  },
  {
    name: "iPhone 15 Pro",
    type: "mobile",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    secChUa: null,
    secChUaMobile: "?1",
    secChUaPlatform: '"iOS"',
    viewport: { width: 393, height: 852, isMobile: true, hasTouch: true },
  },
  {
    name: "Windows 11 Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
  },
  {
    name: "Windows 11 Edge",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    secChUa: '"Chromium";v="134", "Microsoft Edge";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
    viewport: { width: 1536, height: 864, isMobile: false, hasTouch: false },
  },
  {
    name: "macOS Sonoma Safari",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    secChUa: null,
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
    viewport: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  },
  {
    name: "macOS Sonoma Chrome",
    type: "desktop",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="24"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
    viewport: { width: 1680, height: 1050, isMobile: false, hasTouch: false },
  },
];

export const ACCEPT_LANGUAGES = [
  "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "id-ID,id;q=0.9,en;q=0.8",
  "en-US,en;q=0.9,id;q=0.8",
  "en-GB,en;q=0.9,en-US;q=0.8,id;q=0.7",
];

/**
 * Returns a random device profile (optionally filtered by "mobile" or "desktop").
 */
export function getRandomDevice(preferredType = "any") {
  let pool = DEVICE_PROFILES;
  if (preferredType === "mobile" || preferredType === "desktop") {
    pool = DEVICE_PROFILES.filter((d) => d.type === preferredType);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Builds realistic browser headers based on the chosen device profile.
 */
export function buildScraperHeaders(device = getRandomDevice(), customHeaders = {}) {
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
  const headers = {
    "User-Agent": device.userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": lang,
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  if (device.secChUa) {
    headers["Sec-Ch-Ua"] = device.secChUa;
    headers["Sec-Ch-Ua-Mobile"] = device.secChUaMobile;
    headers["Sec-Ch-Ua-Platform"] = device.secChUaPlatform;
  }

  return { ...headers, ...customHeaders };
}

// Global Axios client with auto-changing device and header rotation
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

let jktBrowser = null;

async function getJktBrowser() {
  if (jktBrowser?.connected) return jktBrowser;
  const { default: puppeteer } = await import("puppeteer");
  jktBrowser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  return jktBrowser;
}

async function jktFetch(url) {
  const browser = await getJktBrowser();
  const page = await browser.newPage();
  const device = getRandomDevice("mobile");

  await page.setUserAgent(device.userAgent);
  if (device.viewport) {
    await page.setViewport(device.viewport);
  }

  const extraHeaders = buildScraperHeaders(device, {
    Accept: "application/json, text/plain, */*",
    Referer: "https://jkt48.com/",
    Origin: "https://jkt48.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  });
  await page.setExtraHTTPHeaders(extraHeaders);

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  try {
    const doFetch = async (u) =>
      page.goto(u, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
        cache: "no-store",
      });
    let resp = await doFetch(url);
    if (resp.status() === 304) {
      const sep = url.includes("?") ? "&" : "?";
      resp = await doFetch(`${url}${sep}cb=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
    const ct = (resp.headers()["content-type"] || "").toLowerCase();
    if (!ct.includes("json")) {
      if (resp.status() === 404) throw new Error("Data tidak ditemukan.");
      throw new Error(`Skriper JKT48 gagal (status ${resp.status()}).`);
    }
    const body = await page.evaluate(() => JSON.parse(document.body.innerText));
    return body;
  } finally {
    await page.close();
  }
}

export async function jkt48ListMembers() {
  const { status, data } = await jktFetch("https://jkt48.com/api/v1/members/");
  if (!status || !Array.isArray(data)) throw new Error("Gagal mengambil daftar member.");
  return data.map((m) => ({
    id: m.jkt48_member_id,
    name: m.name,
    nickname: m.nickname,
    code: m.code,
    type: m.type,
    photo: m.photo,
  }));
}

export async function jkt48MemberDetail(idOrName) {
  const list = await jkt48ListMembers();
  const q = String(idOrName).trim().toLowerCase();
  const target =
    list.find((m) => String(m.id) === q) ||
    list.find((m) => m.nickname && m.nickname.toLowerCase() === q) ||
    list.find((m) => m.name.toLowerCase() === q) ||
    list.find((m) => m.nickname && m.nickname.toLowerCase().includes(q)) ||
    list.find((m) => m.name.toLowerCase().includes(q));
  if (!target) throw new Error("Member tidak ditemukan.");
  const { data } = await jktFetch(
    `https://jkt48.com/api/v1/members/${target.id}?lang=id&t=${Date.now()}`
  );
  if (!data) throw new Error("Detail member tidak ditemukan.");
  return {
    id: target.id,
    name: data.name || target.name,
    nickname: data.nickname || target.nickname,
    type: data.type || "",
    birthPlace: data.birth_place || "",
    birthDate: data.birth_date || "",
    bloodType: data.blood_type || "-",
    height: data.body_height ? `${data.body_height} cm` : "-",
    horoscope: data.horoscope || "-",
    twitter: data.twitter_account || "",
    instagram: data.instagram_account || "",
    tiktok: data.tiktok_account || "",
    photo: data.photo_1 || data.photo_2 || target.photo || "",
  };
}

export async function fetchLyrics(artist, title) {
  const { data } = await http.get(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(
      title
    )}`
  );
  if (!data.lyrics) throw new Error("Lirik tidak ditemukan");
  return data.lyrics.trim();
}

export async function translateText(text, lang = "id") {
  const { data } = await http.get(
    "https://translate.googleapis.com/translate_a/single",
    {
      params: {
        client: "gtx",
        sl: "auto",
        tl: lang,
        dt: "t",
        q: text,
      },
    }
  );
  const translated = data?.[0]?.map((seg) => seg?.[0]).join("");
  if (!translated) throw new Error("Terjemahan gagal");
  return {
    original: text,
    translated,
    lang: data?.[2],
  };
}

export async function textToSpeech(text, lang = "id-ID") {
  const { data } = await http.get(
    "https://translate.google.com/translate_tts",
    {
      params: {
        ie: "UTF-8",
        client: "tw-ob",
        tl: lang,
        q: text,
      },
      responseType: "arraybuffer",
    }
  );
  return Buffer.from(data);
}

export async function searchAnime(query) {
  const { data } = await http.get("https://api.jikan.moe/v4/anime", {
    params: { q: query, limit: 1 },
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
    genres: anime.genres.map((g) => g.name).join(", "),
    synopsis: anime.synopsis?.slice(0, 500),
    url: anime.url,
    image: anime.images?.jpg?.large_image_url,
  };
}

export async function webSearch(query) {
  const { data } = await http.get(
    "https://api.duckduckgo.com/",
    {
      params: { q: query, format: "json", no_html: 1 },
    }
  );
  const results = data.RelatedTopics?.filter((t) => t.Text)
    .slice(0, 5)
    .map((t) => ({
      text: t.Text.slice(0, 150),
      url: t.FirstURL,
    }));
  if (!results?.length) {
    return [
      {
        text: `Hasil pencarian untuk: ${query}`,
        url: "",
      },
    ];
  }
  return results;
}

export async function igDownload(url) {
  const shortcode = url.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!shortcode) throw new Error("URL Instagram tidak valid");
  const device = getRandomDevice("mobile");
  const headers = buildScraperHeaders(device, {
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://www.instagram.com/",
    Accept: "*/*",
  });
  const { data } = await http.get(
    `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
    { headers }
  );
  const result = data?.[0];
  if (!result) throw new Error("Media tidak ditemukan");
  const items = result.graphql?.shortcode_media || result;
  const media = items.is_video ? items.video_url : items.display_url;
  if (!media) throw new Error("Media tidak ditemukan");
  return { type: items.is_video ? "video" : "image", url: media };
}

export async function ytInfo(url) {
  const videoId =
    url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("URL YouTube tidak valid");
  const { data } = await http.get(
    `https://www.youtube.com/oembed`,
    { params: { url: `https://www.youtube.com/watch?v=${videoId}`, format: "json" } }
  );
  return {
    title: data.title,
    channel: data.author_name,
    id: videoId,
    duration: "Lihat link asli",
    views: 0,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export async function tiktokDownload(url) {
  const device = getRandomDevice("mobile");
  const headers = buildScraperHeaders(device, {
    "Content-Type": "application/json",
    Origin: "https://snaptik.fi",
    Referer: "https://snaptik.fi/id/download-tiktok-video",
    Accept: "application/json, text/plain, */*",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  });

  const { data } = await http.post(
    "https://snaptik.fi/api/tiktok",
    { url, no_watermark: true },
    { headers }
  );

  if (!data?.download_link) {
    throw new Error(data?.message || "Video tidak ditemukan");
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
  const device = getRandomDevice();
  const headers = buildScraperHeaders(device, {
    Accept: "*/*",
    ...customHeaders,
  });
  const { data } = await http.get(url, {
    headers,
    responseType: "arraybuffer",
  });
  return Buffer.from(data);
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
    throw new Error("API key AI tidak dikonfigurasi (OPENAI_API_KEY / GEMINI_API_KEY)");
  }
}