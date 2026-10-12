import { kolIdJob } from "./client.js";

function firstString(...vals) {
  for (const v of vals.flat(Infinity)) {
    if (typeof v === "string" && v.trim().startsWith("http")) return v.trim();
  }
  return "";
}

export async function downloadTiktok(targetUrl, opts = {}) {
  const data = await kolIdJob("tiktok", targetUrl, opts);
  const dl = data?.download_link || data?.download || {};
  const noWatermark = firstString(
    data?.no_watermark,
    data?.video_url,
    data?.play,
    dl?.no_watermark,
    dl?.nwm,
    dl?.hdplay,
    data?.hdplay
  );
  const watermark = firstString(data?.watermark, dl?.watermark, data?.wmplay);
  const mp3 = firstString(data?.mp3, data?.music, dl?.mp3, dl?.music);
  const author = data?.author || {};
  if (!noWatermark && !watermark && !mp3) return null;
  return {
    title: data?.title || data?.description || "",
    author: author?.nickname || author?.uniqueId || data?.author_name || "",
    uniqueId: author?.uniqueId || data?.author_unique_id || "",
    cover: firstString(data?.cover, data?.thumbnail, data?.origin_cover),
    duration: Number(data?.duration) || 0,
    playCount: Number(data?.statistics?.play_count ?? data?.play_count) || 0,
    diggCount: Number(data?.statistics?.digg_count ?? data?.digg_count) || 0,
    noWatermark,
    watermark,
    mp3,
    raw: data,
  };
}
