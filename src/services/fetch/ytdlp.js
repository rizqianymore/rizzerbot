import { unifiedDownload } from "./downloaderCompat.js";
import { Readable } from "node:stream";

export async function ensureYtDlp() {
  return "link-engine";
}

export async function probe(url, opts = {}) {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) throw new Error("URL tidak valid.");

  const { fetchSocialDownloader } = await import("./socialdownloader.js").catch(() => ({}));
  if (typeof fetchSocialDownloader === "function") {
    try {
      const meta = await fetchSocialDownloader(targetUrl, { timeout: opts.timeoutMs || 8000 });
      if (meta) {
        return {
          id: targetUrl,
          title: meta.title || "Media",
          uploader: meta.source || "Social Media",
          ext: "mp4",
          url: meta.downloadUrl,
        };
      }
    } catch (_) {}
  }

  return {
    id: targetUrl,
    title: "Media",
    uploader: "Web",
    ext: "mp4",
    url: targetUrl,
  };
}

export async function downloadMedia(url, opts = {}) {
  const mode = opts.mode === "audio" || opts.isAudio ? "audio" : "video";
  const result = await unifiedDownload(url, {
    mode,
    timeoutMs: opts.timeoutMs || 15000,
  });

  if (!result?.buffer?.length) {
    throw new Error("Gagal mengunduh media dari link tersebut.");
  }

  return {
    buffer: result.buffer,
    filepath: "",
    isAudio: mode === "audio",
    info: result.info,
  };
}

export async function streamMedia(url, opts = {}) {
  const dl = await downloadMedia(url, opts);
  const stream = new Readable();
  stream.push(dl.buffer);
  stream.push(null);
  return { stream, isAudio: dl.isAudio };
}

export async function searchFirstVideo(query) {
  const { searchYouTube } = await import("./downloaderCompat.js").catch(() => ({}));
  if (typeof searchYouTube === "function") {
    return await searchYouTube(query);
  }
  return null;
}
