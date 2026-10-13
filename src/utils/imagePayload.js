import fs from "fs";
import path from "path";

const BANNER_PATHS = [
  "assets/image/banner.webp",
  "assets/image/banner.jpg",
  "assets/image/banner.jpeg",
  "assets/image/banner.png",
];

export async function resolveImagePayload(settings = {}) {
  const image = settings.image;

  if (image) {
    if (typeof image === "string" && /^(https?):\/\//i.test(image)) {
      return { url: image };
    }
    try {
      const localPath = path.resolve(process.cwd(), image);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    } catch (_) {}
  }

  for (const rel of BANNER_PATHS) {
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) {
      try {
        return fs.readFileSync(abs);
      } catch (_) {}
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
