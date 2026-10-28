import axios from "axios";
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

/**
 * Terjemahkan teks dengan proteksi fallback ganda (Google Translate -> MyMemory API)
 */
export async function translateText(text, lang = "id") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Teks untuk diterjemahkan kosong");
  if (clean.length > 2500) throw new Error("Teks terlalu panjang (maksimal 2500 karakter)");

  // 1. Coba Google Translate Single API
  try {
    const data = await request.json("https://translate.googleapis.com/translate_a/single", {
      params: {
        client: "gtx",
        sl: "auto",
        tl: lang,
        dt: "t",
        q: clean,
      },
      timeout: 10000,
    });
    const segments = Array.isArray(data?.[0]) ? data[0] : null;
    const translated = segments?.map((seg) => seg?.[0]).join("");
    if (translated) {
      return {
        original: clean,
        translated,
        lang: data?.[2] || "auto",
      };
    }
  } catch (_) {}

  // 2. Fallback ke MyMemory Translation API jika Google rate-limited (HTTP 429)
  try {
    const res = await axios.get("https://api.mymemory.translated.net/get", {
      params: { q: clean, langpair: `autodetect|${lang}` },
      timeout: 12000,
    });
    const translatedText = res.data?.responseData?.translatedText;
    if (translatedText) {
      return {
        original: clean,
        translated: translatedText,
        lang: "auto",
      };
    }
  } catch (mmErr) {
    throw new Error(`Gagal menerjemahkan teks: ${mmErr?.message || "Layanan sibuk"}`);
  }

  throw new Error("Layanan penerjemah sedang tidak dapat merespons.");
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
    timeout: 15000,
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

export async function fetchBuffer(url, customHeaders = {}, maxBytes) {
  if (!/^https?:\/\//i.test(String(url || ""))) {
    throw new Error("URL tidak valid (harus http/https)");
  }
  return await request.buffer(url, {
    headers: customHeaders,
    bypassCloudflare: "auto",
    ...(Number(maxBytes) > 0 ? { maxBytes: Number(maxBytes) } : {}),
  });
}
