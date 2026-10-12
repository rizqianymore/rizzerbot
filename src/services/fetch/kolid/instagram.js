import { kolIdJob } from "./client.js";

function toMediaItems(data) {
  const items = [];
  if (Array.isArray(data?.slides) && data.slides.length) {
    for (const slide of data.slides) {
      const mediaUrl = slide?.url || slide?.thumbnail;
      if (!mediaUrl) continue;
      items.push({ type: slide?.type === "video" ? "mp4" : "image", url: mediaUrl });
    }
  } else if (data?.video_url) {
    items.push({ type: "mp4", url: data.video_url });
  } else if (data?.thumbnail) {
    items.push({ type: "image", url: data.thumbnail });
  }
  return items.filter((m) => m.url);
}

export async function downloadInstagram(targetUrl, opts = {}) {
  const data = await kolIdJob("instagram", targetUrl, opts);
  const media = toMediaItems(data);
  if (!media.length) return null;
  return {
    username: data?.author || data?.username || "",
    title: data?.title || data?.caption || "",
    likes: Number(data?.likes) || 0,
    media,
    raw: data,
  };
}
