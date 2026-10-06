import { request } from "@/src/utils/request.js";

export async function mediafireDownload(url) {
  let host = "";
  try {
    host = new URL(String(url || "").trim()).hostname.toLowerCase();
  } catch {
    throw new Error("URL bukan merupakan tautan MediaFire yang valid.");
  }
  if (host !== "mediafire.com" && !host.endsWith(".mediafire.com")) {
    throw new Error("URL bukan merupakan tautan MediaFire yang valid.");
  }

  const cleanUrl = url.trim();
  const html = await request.text(cleanUrl, {
    bypassCloudflare: "auto",
    timeout: 30000,
  });
  if (typeof html !== "string") {
    throw new Error("Gagal mengambil halaman MediaFire.");
  }

  const dlMatch =
    html.match(/href="([^"]+)"\s+id="downloadButton"/i) ||
    html.match(/id="downloadButton"[^>]*href="([^"]+)"/i) ||
    html.match(/aria-label="Download file"[^>]*href="([^"]+)"/i) ||
    html.match(/https?:\/\/download\d+\.mediafire\.com\/[^\s"'>]+/i);

  const downloadUrl = dlMatch ? (dlMatch[1] || dlMatch[0]) : null;

  if (!downloadUrl) {
    throw new Error("Gagal menemukan link download langsung dari MediaFire. Kemungkinan file telah dihapus atau terkena proteksi password.");
  }

  const filenameMatch =
    html.match(/<div class="filename">([^<]+)<\/div>/i) ||
    html.match(/<span class="filename">([^<]+)<\/span>/i) ||
    html.match(/<title>([^<]+)<\/title>/i);

  let filename = filenameMatch ? filenameMatch[1].trim() : "file";

  filename = filename.replace(/\s*-\s*MediaFire$/i, "").trim();

  const sizeMatch =
    html.match(/<li>File size:\s*<span>([^<]+)<\/span>/i) ||
    html.match(/<span>\(([0-9.]+\s*(?:MB|GB|KB|B))\)<\/span>/i) ||
    html.match(/class="details">[\s\S]*?<span>([^<]+)<\/span>/i);

  const filesize = sizeMatch ? sizeMatch[1].trim() : "Unknown size";

  let mimetype = "application/octet-stream";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "zip") mimetype = "application/zip";
  else if (ext === "rar") mimetype = "application/x-rar-compressed";
  else if (ext === "7z") mimetype = "application/x-7z-compressed";
  else if (ext === "pdf") mimetype = "application/pdf";
  else if (["mp4", "mkv", "mov"].includes(ext)) mimetype = "video/mp4";
  else if (["mp3", "m4a", "wav", "ogg"].includes(ext)) mimetype = "audio/mpeg";
  else if (["jpg", "jpeg", "png", "webp"].includes(ext)) mimetype = `image/${ext === "jpg" ? "jpeg" : ext}`;
  else if (ext === "apk") mimetype = "application/vnd.android.package-archive";

  return {
    downloadUrl,
    filename,
    filesize,
    mimetype,
  };
}

export async function solveSafelink(url) {
  let targetUrl = null;
  const rawUrl = url.trim();

  try {
    const parsed = new URL(rawUrl);
    const searchParams = parsed.searchParams;

    const commonParams = ["url", "r", "link", "target", "dest", "go", "to", "out"];
    for (const p of commonParams) {
      const val = searchParams.get(p);
      if (val) {

        if (/^https?:\/\//i.test(val)) {
          targetUrl = val;
          break;
        }

        try {
          const decoded = Buffer.from(val, "base64").toString("utf-8");
          if (/^https?:\/\//i.test(decoded)) {
            targetUrl = decoded;
            break;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  if (!targetUrl) {
    try {
      const data = await request.text(rawUrl, {
        bypassCloudflare: "auto",
        timeout: 20000,
      });

      if (!targetUrl && typeof data === "string") {
        const metaMatch = data.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i);
        if (metaMatch && metaMatch[1]) {
          targetUrl = metaMatch[1].trim();
        }

        if (!targetUrl) {
          const jsMatch = data.match(/window\.location(?:\.href)?\s*=\s*["'](https?:\/\/[^"']+)["']/i);
          if (jsMatch && jsMatch[1]) {
            targetUrl = jsMatch[1].trim();
          }
        }

        if (!targetUrl) {
          const hostMatch = data.match(/href=["'](https?:\/\/(?:www\.)?(?:mediafire\.com|drive\.google\.com|mega\.nz|sfile\.mobi)[^"']+)["']/i);
          if (hostMatch && hostMatch[1]) {
            targetUrl = hostMatch[1].trim();
          }
        }
      }
    } catch (_) {}
  }

  if (!targetUrl) {
    throw new Error("Gagal mengurai tautan safelink atau tautan dilindungi captcha kompleks.");
  }

  let type = "general";
  if (/mediafire\.com/i.test(targetUrl)) type = "mediafire";
  else if (/drive\.google\.com/i.test(targetUrl)) type = "gdrive";
  else if (/mega\.nz/i.test(targetUrl)) type = "mega";

  return {
    originalUrl: rawUrl,
    targetUrl,
    type,
  };
}
