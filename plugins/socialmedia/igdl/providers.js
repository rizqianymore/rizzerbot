import { downloadInstagram } from "@/src/services/fetch/kolid.js";

export async function downloadFromKolId(targetUrl) {
  const res = await downloadInstagram(targetUrl);
  if (!res) return null;
  return {
    username: res.username,
    likes: res.likes,
    title: res.title,
    media: res.media,
  };
}
