import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "ourin-baileys";

const statusesDir = path.join(process.cwd(), "statuses");

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function unwrap(content) {
  if (!content || typeof content !== "object") return content;
  if (content.ephemeralMessage?.message) return unwrap(content.ephemeralMessage.message);
  if (content.viewOnceMessage?.message) return unwrap(content.viewOnceMessage.message);
  if (content.viewOnceMessageV2?.message) return unwrap(content.viewOnceMessageV2.message);
  if (content.viewOnceMessageV2Extension?.message) return unwrap(content.viewOnceMessageV2Extension.message);
  return content;
}

export async function handleStatusBroadcast(sock, msg, logger) {
  try {
    if (!msg || !msg.message) return;
    const raw = msg.message;
    const content = unwrap(raw) || raw;
    const keys = Object.keys(content || {});
    const mediaKey = keys.includes("imageMessage")
      ? "image"
      : keys.includes("videoMessage")
        ? "video"
        : keys.includes("audioMessage")
          ? "audio"
          : keys.includes("stickerMessage")
            ? "sticker"
            : keys.includes("documentMessage")
              ? "document"
              : null;
    if (!mediaKey) return;

    const node = content[`${mediaKey}Message`];
    if (!node) return;

    const stream = await downloadContentFromMessage(node, mediaKey === "sticker" ? "sticker" : mediaKey);
    const buffer = await streamToBuffer(stream);

    if (!fs.existsSync(statusesDir)) {
      fs.mkdirSync(statusesDir, { recursive: true });
    }

    // Ekstrak identitas pengirim status (nomor HP & pushName jika ada)
    const rawSender = msg.key?.participant || msg.participant || msg.key?.remoteJid || "";
    const number = String(rawSender).split("@")[0].replace(/[^0-9]/g, "") || "unknown";
    const ext =
      mediaKey === "image"
        ? "jpg"
        : mediaKey === "video"
          ? "mp4"
          : mediaKey === "audio"
            ? "m4a"
            : mediaKey === "sticker"
              ? "webp"
              : "bin";

    // Format: status_<nomor>_<timestamp>.<ext>
    const filename = `status_${number}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(statusesDir, filename), buffer);

    // Auto-clean status lama (> 24 jam) agar penyimpanan tidak penuh
    cleanOldStatuses();

    logger?.info?.(`[Status Saver] Status tersimpan dari +${number}: ${filename} (${buffer.length} bytes)`);
  } catch (err) {
    logger?.warn?.(`[Status Saver Error] ${err?.message || err}`);
  }
}

function cleanOldStatuses() {
  try {
    if (!fs.existsSync(statusesDir)) return;
    const files = fs.readdirSync(statusesDir);
    const now = Date.now();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 jam sesuai durasi status WA

    for (const f of files) {
      const match = f.match(/_(\d+)\./);
      if (match && match[1]) {
        const fileTime = Number(match[1]);
        if (now - fileTime > MAX_AGE_MS) {
          try {
            fs.unlinkSync(path.join(statusesDir, f));
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}
