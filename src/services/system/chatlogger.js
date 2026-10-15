import fs from "fs";
import path from "path";
import { db } from "@/src/core/database.js";

const LOGS_DIR = path.join(process.cwd(), "database", "chat_logs");
const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (_) {}
}

function getDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function _getLogFilePath(date = new Date()) {
  return path.join(LOGS_DIR, `messages-${getDateString(date)}.json`);
}

function readLogFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content || "[]");
    }
  } catch (_) {}
  return [];
}

let writeQueue = [];
let flushTimeout = null;

function flushLogs() {
  if (writeQueue.length === 0) return;
  const itemsToSave = [...writeQueue];
  writeQueue = [];

  const grouped = new Map();
  for (const item of itemsToSave) {
    const dateStr = item.date || getDateString(new Date(item.timestamp));
    const filePath = path.join(LOGS_DIR, `messages-${dateStr}.json`);
    if (!grouped.has(filePath)) {
      grouped.set(filePath, []);
    }
    grouped.get(filePath).push(item);
  }

  for (const [filePath, newLogs] of grouped.entries()) {
    try {
      const existing = readLogFile(filePath);
      const combined = existing.concat(newLogs);
      const serialized = JSON.stringify(combined, null, 2);
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      try {
        fs.writeFileSync(temporaryPath, serialized, "utf-8");
        fs.renameSync(temporaryPath, filePath);
      } catch (_) {
        fs.writeFileSync(filePath, serialized, "utf-8");
        try {
          fs.rmSync(temporaryPath, { force: true });
        } catch (_) {}
      }
    } catch (_) {}
  }
}

export function recordMessage(sock, msg) {
  try {
    if (!msg || !msg.key || !msg.message) return;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@newsletter")) return;

    const rawSender = msg.key.participant || (msg.key.fromMe ? sock?.user?.id : remoteJid) || remoteJid;
    const sender =
      db.pickPhoneJid(
        msg.key.participantAlt,
        msg.key.remoteJidAlt,
        msg.key.participantPn,
        msg.key.senderPn,
        rawSender
      ) || rawSender;
    const isGroup = remoteJid.endsWith("@g.us");

    const m = msg.message;
    const text =
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      "";

    let mediaType = null;
    if (m.imageMessage) mediaType = "image";
    else if (m.videoMessage) mediaType = "video";
    else if (m.audioMessage) mediaType = "audio";
    else if (m.documentMessage) mediaType = "document";
    else if (m.stickerMessage) mediaType = "sticker";
    else if (m.contactMessage) mediaType = "contact";
    else if (m.locationMessage) mediaType = "location";

    const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();
    const now = new Date(timestamp);

    const logEntry = {
      id: msg.key.id,
      timestamp,
      date: getDateString(now),
      time: now.toLocaleTimeString("id-ID"),
      botJid: sock?.user?.id || null,
      isSubBot: Boolean(sock?.isSubBot),
      remoteJid,
      isGroup,
      fromMe: Boolean(msg.key.fromMe),
      sender,
      pushName: msg.pushName || null,
      text: text || null,
      mediaType,
    };

    writeQueue.push(logEntry);

    if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flushTimeout = null;
        flushLogs();
      }, 1500);
      if (flushTimeout.unref) flushTimeout.unref();
    }
  } catch (_) {}
}

export function cleanupOldLogs(logger) {
  try {
    if (!fs.existsSync(LOGS_DIR)) return 0;
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith("messages-") || !file.endsWith(".json")) continue;
      const filePath = path.join(LOGS_DIR, file);

      try {
        const stats = fs.statSync(filePath);

        const dateMatch = file.match(/^messages-(\d{4}-\d{2}-\d{2})\.json$/);
        let fileAgeMs = now - stats.mtimeMs;

        if (dateMatch) {
          const fileDate = new Date(`${dateMatch[1]}T00:00:00`).getTime();
          if (!isNaN(fileDate)) {
            fileAgeMs = Math.max(fileAgeMs, now - (fileDate + 24 * 60 * 60 * 1000));
          }
        }

        if (fileAgeMs > RETENTION_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger?.info?.(`[Chat Logger] File log lama dihapus (> 3 hari): ${file}`);
        }
      } catch (_) {}
    }

    return deletedCount;
  } catch (err) {
    logger?.error?.("[Chat Logger] Gagal membersihkan log lama:", err.message);
    return 0;
  }
}

let cronStarted = false;
export function startChatLogCron(logger) {
  if (cronStarted) return;
  cronStarted = true;

  cleanupOldLogs(logger);

  const interval = 6 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    cleanupOldLogs(logger);
  }, interval);

  if (timer && timer.unref) timer.unref();
  logger?.info?.("[Chat Logger] Perekam pesan aktif. Retensi: 3 hari auto-cleanup.");
}

export function getChatLogsList() {
  flushLogs();
  if (!fs.existsSync(LOGS_DIR)) return [];
  const files = fs.readdirSync(LOGS_DIR);
  return files
    .filter((f) => f.startsWith("messages-") && f.endsWith(".json"))
    .map((file) => {
      const filePath = path.join(LOGS_DIR, file);
      const stat = fs.statSync(filePath);
      return {
        file,
        size: stat.size,
        date: file.replace("messages-", "").replace(".json", ""),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getChatLogContent(dateOrFile) {
  flushLogs();
  let fileName = dateOrFile;
  if (!fileName.endsWith(".json")) {
    fileName = `messages-${dateOrFile}.json`;
  }
  const filePath = path.join(LOGS_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return {
      file: fileName,
      filePath,
      data: JSON.parse(raw || "[]"),
    };
  } catch (_) {
    return null;
  }
}

process.once("beforeExit", () => {
  try {
    flushLogs();
  } catch (_) {}
});
