import { downloadMediaMessage } from "ourin-baileys";

export const DEFAULT_MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export function formatBytes(n) {
  if (!Number.isFinite(Number(n))) return "-";
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function checkMediaSize(buf, maxBytes) {
  if (buf && buf.length > maxBytes) {
    throw new Error(
      `Media terlalu besar (${formatBytes(buf.length)}, maks ${formatBytes(maxBytes)}). Kirim file yang lebih kecil.`
    );
  }
  return buf;
}

export async function getMediaBuffer(sock, msg, opts = {}) {
  if (!msg) return null;
  const maxBytes = Number(opts?.maxBytes) > 0 ? Number(opts.maxBytes) : DEFAULT_MAX_MEDIA_BYTES;

  let target = msg;
  if (!target.key && !target.message && typeof target === "object") {
    target = { key: {}, message: target };
  }
  try {
    const { default: pino } = await import("pino");
    const safeLogger = sock?.logger || pino({ level: "silent" });
    const buf = await downloadMediaMessage(
      target,
      "buffer",
      {},
      {
        logger: safeLogger,
        reuploadRequest: sock?.updateMediaMessage?.bind(sock),
      }
    );
    if (buf && buf.length > 0) return checkMediaSize(buf, maxBytes);
    return buf;
  } catch (err) {
    if (err && String(err.message || "").startsWith("Media terlalu besar")) throw err;

    try {
      if (typeof sock?.downloadMediaMessage === "function") {
        const buf2 = await sock.downloadMediaMessage(target);
        if (buf2 && buf2.length > 0) return checkMediaSize(buf2, maxBytes);
        return buf2;
      }
    } catch (err2) {
      if (err2 && String(err2.message || "").startsWith("Media terlalu besar")) throw err2;
    }
    console.warn("[getMediaBuffer] gagal download:", err?.message || err);
    return null;
  }
}

export function isVideoOrAnimated(buf) {
  if (!buf || buf.length < 12) return false;

  if (buf.slice(0, 3).toString() === "GIF") return true;

  const ftyp = buf.slice(4, 8).toString();
  if (ftyp === "ftyp" || ftyp === "moov") return true;
  if (buf.slice(0, 4).toString() === "\x00\x00\x00 ") return true;

  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;

  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "AVI ") return true;

  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
    if (buf.includes(Buffer.from("ANIM")) || buf.includes(Buffer.from("ANMF"))) return true;
  }
  return false;
}
