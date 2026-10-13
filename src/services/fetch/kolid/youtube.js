import { kolIdJob } from "./client.js";

const QUALITY_RANK = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];

function rankOf(q) {
  const m = String(q || "")
    .toLowerCase()
    .match(/(\d+p)/);
  const i = m ? QUALITY_RANK.indexOf(m[1]) : -1;
  return i === -1 ? 99 : i;
}

function isMuxed(v) {
  if (!v || typeof v !== "object") return false;
  const a = v.audio ?? v.has_audio ?? v.muxed;
  if (a === true) return true;
  if (typeof a === "string") return ["true", "1", "yes"].includes(a.trim().toLowerCase());
  if (typeof a === "number") return a !== 0;
  return false;
}

export function pickYoutubeVideo(videos = [], maxQuality = "720p") {
  const list = (Array.isArray(videos) ? videos : []).filter(
    (v) => v?.url && String(v.format || "video").toLowerCase() !== "audio"
  );
  if (!list.length) return null;
  const ceiling = rankOf(maxQuality);
  // rank kecil = kualitas tinggi; ambil yang rank >= ceiling (720p atau lebih rendah)
  const inCeiling = list.filter((v) => {
    const r = rankOf(v.quality);
    return r === 99 || r >= ceiling;
  });
  const pool = inCeiling.length ? inCeiling : list;
  const muxed = pool.filter(isMuxed);
  const sorted = [...(muxed.length ? muxed : pool)].sort((a, b) => rankOf(a.quality) - rankOf(b.quality));
  const best = sorted[0];
  if (!best) return null;
  return {
    url: best.url,
    quality: best.quality || "?",
    hasAudio: isMuxed(best),
  };
}

export async function downloadYoutube(targetUrl, { maxQuality = "720p", ...opts } = {}) {
  const data = await kolIdJob("youtube", targetUrl, opts);
  const picked = pickYoutubeVideo(data?.video || data?.videos || data?.formats, maxQuality);
  if (!picked) return null;
  const channel = data?.channel || {};
  return {
    videoId: data?.video_id || "",
    title: data?.title || "",
    thumbnail: data?.thumbnail || "",
    duration: Number(data?.length_seconds ?? data?.duration) || 0,
    channelName: channel?.name || data?.author || "",
    channelAvatar: channel?.avatar || "",
    channelSubs: channel?.subscriber_count_text || "",
    videoUrl: picked.url,
    quality: picked.quality,
    hasAudio: picked.hasAudio,
    raw: data,
  };
}
