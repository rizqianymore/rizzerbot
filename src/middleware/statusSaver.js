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

    const participant = msg.key?.participant || msg.key?.remoteJid || "unknown";
    const number =
      String(participant)
        .split("@")[0]
        .replace(/[^0-9]/g, "") || "unknown";
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
    const filename = `status_${number}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(statusesDir, filename), buffer);

    if (logger?.info) {
      logger.info(`[Status Saver] Saved status from ${number} as ${filename}`);
    }
  } catch (err) {
    if (logger?.error) {
      logger.error("[Status Saver Error]", err?.message || err);
    } else if (logger?.warn) {
      logger.warn("[Status Saver Error]", err?.message || err);
    }
  }
}
