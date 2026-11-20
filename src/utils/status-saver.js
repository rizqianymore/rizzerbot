import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "baileys";
import { ensureVideoCompatible } from "@/src/services/fetch/downloaderCompat.js";

const STATUSES_DIR = path.join(process.cwd(), "statuses");

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function handleIncomingStatus(sock, msg, autoRead = false) {
  try {
    if (!msg.key || msg.key.remoteJid !== "status@broadcast") return;

    if (autoRead) {
      sock.readMessages([msg.key]).catch(() => {});
    }

    if (!msg.message) return;

    if (!fs.existsSync(STATUSES_DIR)) {
      fs.mkdirSync(STATUSES_DIR, { recursive: true });
    }

    const sender =
      String(msg.key.participant || "")
        .split("@")[0]
        .replace(/\D/g, "") || "unknown";
    const ts = Date.now();

    const text = msg.message.extendedTextMessage?.text || msg.message.conversation;
    if (text) {
      const fileName = `status_${sender}_${ts}.txt`;
      fs.writeFileSync(path.join(STATUSES_DIR, fileName), text, "utf8");
      return;
    }

    const m = msg.message;
    const media = m.imageMessage || m.videoMessage || m.audioMessage;
    const type = m.imageMessage ? "image" : m.videoMessage ? "video" : m.audioMessage ? "audio" : null;
    if (!media || !type) return;

    const stream = await downloadContentFromMessage(media, type);
    let buf = await streamToBuffer(stream);
    if (!buf || buf.length < 100) return;

    let ext = type === "image" ? ".jpg" : type === "video" ? ".mp4" : ".m4a";
    if (type === "video") {
      buf = await ensureVideoCompatible(buf);
    }

    const fileName = `status_${sender}_${ts}${ext}`;
    fs.writeFileSync(path.join(STATUSES_DIR, fileName), buf);
  } catch (_) {

  }
}
