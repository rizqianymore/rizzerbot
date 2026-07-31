import fs from "fs";
import path from "path";
import { downloadMediaMessage } from "baileys";

const statusesDir = path.join(process.cwd(), "statuses");

export async function handleStatusBroadcast(sock, msg, logger) {
  if (!msg.message) return;
  const keys = Object.keys(msg.message);
  const hasMedia =
    keys.includes("imageMessage") || keys.includes("videoMessage");
  if (!hasMedia) return;

  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: {
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
          }),
        },
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    if (!fs.existsSync(statusesDir)) {
      fs.mkdirSync(statusesDir, { recursive: true });
    }

    const participant = msg.key.participant
      ? msg.key.participant.split("@")[0]
      : "unknown";
    const extension = keys.includes("imageMessage") ? "jpg" : "mp4";
    const filename = `status_${participant}_${Date.now()}.${extension}`;

    fs.writeFileSync(path.join(statusesDir, filename), buffer);
    if (logger) {
      logger.info(`[Status Saver] Saved status from ${participant} as ${filename}`);
    }
  } catch (err) {
    if (logger) {
      logger.error("[Status Saver Error]", err);
    }
  }
}
