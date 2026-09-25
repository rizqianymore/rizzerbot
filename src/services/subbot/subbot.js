import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import { enqueueMessage } from "@/src/core/queue.js";
import { logger } from "@/src/core/connection.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";

const subBots = new Map(); // id -> { sock, number, status, startedAt }
const baseSessionsDir = path.join(process.cwd(), "assets", "sessions", "sub_bots");

if (!fs.existsSync(baseSessionsDir)) {
  fs.mkdirSync(baseSessionsDir, { recursive: true });
}

/**
 * Start a new sub bot instance with phone number pairing code
 */
export async function createSubBot(number, onPairingCode) {
  const cleanNumber = number.replace(/[^0-9]/g, "");
  if (!cleanNumber || cleanNumber.length < 8) {
    throw new Error("Nomor WhatsApp tidak valid! Gunakan format internasional (contoh: 628xxx).");
  }

  const botId = `sub_${cleanNumber}`;
  if (subBots.has(botId) && subBots.get(botId)?.status === "online") {
    throw new Error(`Bot dengan nomor ${cleanNumber} sudah aktif online!`);
  }

  const sessionDir = path.join(baseSessionsDir, botId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Validasi file creds sesi subbot
  const credsPath = path.join(sessionDir, "creds.json");
  if (fs.existsSync(credsPath)) {
    try {
      const stats = fs.statSync(credsPath);
      if (stats.size === 0) throw new Error("creds.json kosong");
      const parsed = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      if (!parsed || typeof parsed !== "object" || !parsed.noiseKey) {
        throw new Error("Format creds subbot korup");
      }
    } catch (err) {
      logger.warn(`[SubBot ${cleanNumber}] Sesi lama rusak (${err.message}). Mereset sesi subbot...`);
      deleteFolderRecursive(sessionDir);
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1043857760],
  }));

  const msgRetryCounterCache = new Map();
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: true,
    syncFullHistory: false,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: (jid) => jid?.endsWith("@broadcast") && jid !== "status@broadcast",
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
  });

  const botEntry = {
    id: botId,
    number: cleanNumber,
    sock,
    status: "connecting",
    startedAt: Date.now(),
  };
  subBots.set(botId, botEntry);

  sock.ev.on("creds.update", saveCreds);

  // Request pairing code if not registered yet
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(cleanNumber);
        if (typeof onPairingCode === "function") {
          onPairingCode(code);
        }
      } catch (err) {
        logger.error(`[SubBot ${cleanNumber}] Pairing code error:`, err.message);
      }
    }, 2500);
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      botEntry.status = "online";
      logger.info(`[SubBot ${cleanNumber}] Connected successfully!`);
    } else if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        `[SubBot ${cleanNumber}] Connection closed (status: ${statusCode}). Reconnect: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        botEntry.status = "reconnecting";
        setTimeout(() => {
          createSubBot(cleanNumber, onPairingCode).catch(() => {});
        }, 5000);
      } else {
        botEntry.status = "disconnected";
        subBots.delete(botId);
        try {
          deleteFolderRecursive(sessionDir);
        } catch (_) {}
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
      enqueueMessage(sock, msg, logger);
    }
  });

  return botEntry;
}

/**
 * Stop and delete a sub bot
 */
export async function stopSubBot(identifier) {
  const clean = identifier.replace(/[^0-9]/g, "");
  const botId = clean ? `sub_${clean}` : identifier;
  const bot = subBots.get(botId);

  if (bot?.sock) {
    try {
      bot.sock.ev.removeAllListeners("connection.update");
      bot.sock.ev.removeAllListeners("messages.upsert");
      bot.sock.end();
    } catch (_) {}
  }
  subBots.delete(botId);

  const sessionDir = path.join(baseSessionsDir, botId);
  try {
    deleteFolderRecursive(sessionDir);
  } catch (_) {}

  return true;
}

/**
 * Get all active sub bots
 */
export function getSubBotsList() {
  const list = [];
  for (const [id, entry] of subBots.entries()) {
    list.push({
      id,
      number: entry.number,
      status: entry.status,
      uptime: Math.floor((Date.now() - entry.startedAt) / 1000),
    });
  }
  return list;
}

/**
 * Auto restore existing saved sub bot sessions on startup
 */
export async function autoRestoreSubBots() {
  try {
    if (!fs.existsSync(baseSessionsDir)) return;
    const folders = fs.readdirSync(baseSessionsDir);
    for (const folder of folders) {
      if (folder.startsWith("sub_")) {
        const number = folder.replace("sub_", "");
        logger.info(`[SubBot] Restoring saved sub bot session for ${number}...`);
        createSubBot(number).catch((err) => {
          logger.error(`[SubBot Restore Error] ${number}:`, err.message);
        });
      }
    }
  } catch (err) {
    logger.error("[Auto Restore SubBots Error]", err.message);
  }
}
