import { request } from "@/src/utils/request.js";

export async function toBuffer(src) {
  if (src.buffer) return src.buffer;
  return request.buffer(src.url, {
    headers: { Referer: "https://www.instagram.com/" },
    timeout: 20000,
  });
}

export async function sendImage(sock, remoteJid, msg, target, cap) {
  try {
    let buf = await toBuffer(target);

    const isWebp =
      buf.length > 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50;
    if (isWebp) {
      try {
        const { default: sharp } = await import("sharp");
        buf = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
      } catch (_) {}
    }
    await sock.sendMessage(remoteJid, { image: buf, caption: cap }, { quoted: msg });
  } catch (_) {
    if (target.url) {
      await sock.sendMessage(remoteJid, { image: { url: target.url }, caption: cap }, { quoted: msg });
    } else {
      throw new Error("Gagal mengambil gambar Instagram.");
    }
  }
}

export async function sendVideo(sock, remoteJid, msg, target, cap) {
  try {
    let buf = await toBuffer(target);
    // auto convert biar kebuka di WA (webm/mkv -> mp4 h264/aac)
    try {
      const { ensureVideoCompatible, sniffMime } = await import("@/src/services/fetch/downloaderCompat.js");
      const mime = sniffMime(buf);
      if (!mime.includes("mp4")) {
        const conv = await ensureVideoCompatible(buf);
        if (conv?.length) buf = conv;
      }
    } catch (_) {}
    await sock.sendMessage(remoteJid, { video: buf, caption: cap, mimetype: "video/mp4" }, { quoted: msg });
  } catch (_) {
    if (target.url) {
      // fallback url langsung, tapi coba buffer+convert dulu biar tidak gagal buka
      try {
        const { request } = await import("@/src/utils/request.js");
        const b = await request.buffer(target.url, { timeout: 25000, bypassCloudflare: "auto" });
        const { ensureVideoCompatible } = await import("@/src/services/fetch/downloaderCompat.js");
        const conv = await ensureVideoCompatible(b);
        await sock.sendMessage(remoteJid, { video: conv || b, caption: cap, mimetype: "video/mp4" }, { quoted: msg });
        return;
      } catch (_) {}
      await sock.sendMessage(
        remoteJid,
        { video: { url: target.url }, caption: cap, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } else {
      throw new Error("Gagal mengambil video Instagram.");
    }
  }
}
