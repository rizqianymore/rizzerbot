// DEPRECATED: kol.id sering gagal (CSRF/token) — dialihkan ke unified downloader
import { unifiedDownload, sniffMime } from "@/src/services/fetch/downloaderCompat.js";

export async function downloadFromKolId(targetUrl, opts = {}) {
  try {
    const { buffer, info } = await unifiedDownload(targetUrl, { mode: "video", logger: opts.logger });
    if (!buffer?.length) return null;
    const mime = sniffMime(buffer);
    return {
      username: info?.uploader || info?.author || "",
      likes: 0,
      title: info?.title || "",
      media: [{ type: mime.startsWith("image/") ? "image" : "mp4", buffer, url: "" }],
    };
  } catch (_) {
    return null;
  }
}
