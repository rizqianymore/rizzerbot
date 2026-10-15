import fs from "fs";
import path from "path";

const BANNER_PATHS = [
  "assets/image/banner.webp",
  "assets/image/banner.jpg",
  "assets/image/banner.jpeg",
  "assets/image/banner.png",
];

let _bannerCache = { key: "", mtimeMs: 0, size: 0, buf: null };

function readCachedFile(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (
      _bannerCache.buf &&
      _bannerCache.key === absPath &&
      _bannerCache.mtimeMs === stat.mtimeMs &&
      _bannerCache.size === stat.size
    ) {
      return _bannerCache.buf;
    }
    const buf = fs.readFileSync(absPath);
    _bannerCache = { key: absPath, mtimeMs: stat.mtimeMs, size: stat.size, buf };
    return buf;
  } catch (_) {
    return null;
  }
}

export function clearImagePayloadCache() {
  _bannerCache = { key: "", mtimeMs: 0, size: 0, buf: null };
}

export async function resolveImagePayload(settings = {}) {
  const image = settings.image;

  if (Buffer.isBuffer(image)) return image;

  if (image) {
    if (typeof image === "string" && /^(https?):\/\//i.test(image)) {
      return { url: image };
    }
    try {
      const localPath = path.resolve(process.cwd(), image);
      if (fs.existsSync(localPath)) {
        return readCachedFile(localPath);
      }
    } catch (_) {}
  }

  for (const rel of BANNER_PATHS) {
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) {
      const buf = readCachedFile(abs);
      if (buf) return buf;
    }
  }

  return null;
}

export async function sendWithImage(sock, remoteJid, imagePayload, caption, quoted) {
  if (imagePayload) {
    try {
      return await sock.sendMessage(remoteJid, { image: imagePayload, caption }, { quoted });
    } catch (_) {}
  }
  return await sock.sendMessage(remoteJid, { text: caption }, { quoted });
}
