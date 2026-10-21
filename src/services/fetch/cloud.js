import axios from "axios";
import { request } from "@/src/utils/request.js";

const GOOGLE_DRIVE_ID_REGEX = /(?:file\/d\/|[?&]id=)([a-zA-Z0-9_-]{10,})/;
const TERABOX_REGEX = /(?:terabox\.com|1024terabox\.com|terabox\.app)\/(?:s|share|t)\/([a-zA-Z0-9_-]{4,})/;

export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

function baseHeaders(referer) {
  return {
    "User-Agent": UA,
    Accept: "*/*",
    ...(referer ? { Referer: referer } : {}),
  };
}

function parseFileName(contentDisposition) {
  if (!contentDisposition) return null;
  const utf8 = String(contentDisposition).match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch (_) {}
  }
  const plain = String(contentDisposition).match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

function guessExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("wordprocessingml")) return ".docx";
  if (m.includes("spreadsheetml")) return ".xlsx";
  if (m.includes("presentationml")) return ".pptx";
  if (m.includes("zip")) return ".zip";
  if (m.includes("rar")) return ".rar";
  if (m.includes("7z")) return ".7z";
  if (m.includes("audio/mpeg")) return ".mp3";
  if (m.includes("audio/")) return ".m4a";
  if (m.includes("video/mp4")) return ".mp4";
  if (m.includes("image/png")) return ".png";
  if (m.includes("image/jpeg")) return ".jpg";
  if (m.includes("text/plain")) return ".txt";
  return ".bin";
}

function looksLikeHtml(buffer) {
  if (!buffer?.length) return false;
  const head = buffer.slice(0, 600).toString("utf8").toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html") || head.includes("<head");
}

export function isTeraboxUrl(url) {
  return TERABOX_REGEX.test(String(url || ""));
}

export function isGoogleDriveUrl(url) {
  return /drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com/i.test(String(url || ""));
}

/**
 * Mengunduh file publik Google Drive langsung ke buffer.
 * @returns {Promise<{buffer: Buffer, fileName: string, mime: string}>}
 */
export async function downloadGoogleDrive(url, logger) {
  const match = String(url).match(GOOGLE_DRIVE_ID_REGEX);
  if (!match) throw new Error("ID file Google Drive tidak ditemukan dalam link.");
  const fileId = match[1];

  const headers = baseHeaders("https://drive.google.com/");
  const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

  let headInfo = {};
  try {
    const head = await axios({
      method: "HEAD",
      url: directUrl,
      headers,
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    headInfo = head.headers || {};
  } catch (err) {
    logger?.warn?.(`[gdrive head] ${err?.message || err}`);
  }

  let buffer = await request.buffer(directUrl, {
    headers,
    timeout: 90000,
    maxBytes: MAX_DOWNLOAD_BYTES,
    retries: 1,
  });
  if (!buffer?.length) throw new Error("Google Drive mengembalikan file kosong.");

  // Google Drive kadang mengirim halaman peringatan (virus scan) berupa HTML.
  if (looksLikeHtml(buffer)) {
    const html = buffer.toString("utf8");
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
    if (confirmMatch) {
      const retryUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}`;
      buffer = await request.buffer(retryUrl, {
        headers,
        timeout: 90000,
        maxBytes: MAX_DOWNLOAD_BYTES,
        retries: 1,
      });
    }
    if (looksLikeHtml(buffer)) {
      throw new Error("File memerlukan izin/konfirmasi. Pastikan file bersifat publik dan dapat diunduh.");
    }
  }

  let mime = headInfo["content-type"] || "application/octet-stream";
  if (/text\/html/i.test(mime)) mime = "application/octet-stream";
  let fileName = parseFileName(headInfo["content-disposition"]) || `GoogleDrive_${fileId}`;
  if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) fileName += guessExt(mime);

  return { buffer, fileName, mime };
}

function findDownloadLink(data, depth = 0) {
  if (!data || depth > 8) return null;
  if (typeof data === "string") {
    return /^https?:\/\//i.test(data) && /(dlink|download|\.mp4|\.mkv|\.zip|\.rar|\.pdf|\.apk)/i.test(data)
      ? data
      : null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const link = findDownloadLink(item, depth + 1);
      if (link) return link;
    }
    return null;
  }
  if (typeof data === "object") {
    for (const key of ["dlink", "download", "downloadLink", "download_url", "downloadUrl"]) {
      const value = data[key];
      if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
    }
    for (const key of Object.keys(data)) {
      const link = findDownloadLink(data[key], depth + 1);
      if (link) return link;
    }
  }
  return null;
}

function findFileName(data, depth = 0) {
  if (!data || depth > 8) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const name = findFileName(item, depth + 1);
      if (name) return name;
    }
    return null;
  }
  if (typeof data === "object") {
    for (const key of ["filename", "file_name", "server_filename", "name"]) {
      if (typeof data[key] === "string" && data[key].trim()) return data[key].trim();
    }
    for (const key of Object.keys(data)) {
      const name = findFileName(data[key], depth + 1);
      if (name) return name;
    }
  }
  return null;
}

/**
 * Best-effort mengunduh file dari link share Terabox publik.
 * Terabox membatasi unduhan tanpa login/cookie, sehingga kegagalan
 * dikembalikan sebagai error yang informatif.
 * @returns {Promise<{buffer: Buffer, fileName: string, mime: string}>}
 */
export async function downloadTerabox(url, logger) {
  const match = String(url).match(TERABOX_REGEX);
  if (!match) throw new Error("Link Terabox tidak valid (contoh: https://terabox.com/s/xxxxxx).");
  const surl = match[1];
  const referer = `https://www.terabox.com/s/${surl}`;

  const endpoints = [
    `https://www.terabox.com/api/share/info?surl=${encodeURIComponent(surl)}`,
    `https://www.1024terabox.com/api/share/info?surl=${encodeURIComponent(surl)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await request.json(endpoint, {
        headers: baseHeaders(referer),
        timeout: 20000,
        retries: 1,
      });
      const link = findDownloadLink(data);
      if (!link) continue;

      const buffer = await request.buffer(link, {
        headers: baseHeaders(referer),
        timeout: 90000,
        maxBytes: MAX_DOWNLOAD_BYTES,
        retries: 1,
      });
      if (!buffer?.length) continue;

      return {
        buffer,
        fileName: findFileName(data) || `Terabox_${surl}`,
        mime: "application/octet-stream",
      };
    } catch (err) {
      logger?.warn?.(`[terabox] ${err?.message || err}`);
    }
  }

  throw new Error(
    "Terabox membatasi unduhan langsung untuk link publik (butuh login/cookie). " +
      `Buka link berikut di browser untuk mengunduh manual:\n${url}`
  );
}
