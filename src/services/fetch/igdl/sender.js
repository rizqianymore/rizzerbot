export async function toBuffer(src) {
  if (src.buffer) return src.buffer;
  const r = await fetch(src.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
      Referer: "https://www.instagram.com/",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Fetch media HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function sendImage(sock, remoteJid, msg, target, cap) {
  try {
    let buf = await toBuffer(target);
    // WhatsApp image message tidak selalu mau terima webp langsung — konversi ke jpeg.
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
    const buf = await toBuffer(target);
    await sock.sendMessage(remoteJid, { video: buf, caption: cap, mimetype: "video/mp4" }, { quoted: msg });
  } catch (_) {
    if (target.url) {
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
