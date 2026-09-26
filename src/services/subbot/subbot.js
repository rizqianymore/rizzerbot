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
import { db } from "@/src/core/database.js";
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
    emitOwnEvents: true,
  });

  sock.isSubBot = true;
  sock.subBotNumber = cleanNumber;

  const botEntry = {
    id: botId,
    number: cleanNumber,
    sock,
    status: "connecting",
    startedAt: Date.now(),
  };
  subBots.set(botId, botEntry);

  // Pre-grant Owner & Premium ke nomor yang dijadikan bot
  const targetJid = `${cleanNumber}@s.whatsapp.net`;
  db.setOwner(targetJid, true);

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
      const botUserJid = db.normalizeJid(sock.user?.id) || `${cleanNumber}@s.whatsapp.net`;
      db.registerBotJid(botUserJid);

      // Pastikan nomor sub-bot otomatis menjadi Owner dan Premium di database
      db.setOwner(botUserJid, true);
      db.updateUser(botUserJid, {
        name: sock.user?.name || `SubBot (+${cleanNumber})`,
      });
      logger.info(`[SubBot ${cleanNumber}] Berhasil mendapatkan hak akses Owner & Premium otomatis.`);
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
 * Auto update & sync database for all existing sub-bots on the server
 */
export async function syncSubBotsDatabase() {
  let updatedCount = 0;
  try {
    if (!fs.existsSync(baseSessionsDir)) return 0;
    const folders = fs.readdirSync(baseSessionsDir);

    for (const folder of folders) {
      if (folder.startsWith("sub_")) {
        const number = folder.replace("sub_", "").replace(/[^0-9]/g, "");
        if (!number) continue;

        const sessionDir = path.join(baseSessionsDir, folder);
        const credsPath = path.join(sessionDir, "creds.json");
        let botName = `SubBot (+${number})`;
        const jidsToSync = new Set([`${number}@s.whatsapp.net`]);

        if (fs.existsSync(credsPath)) {
          try {
            const raw = fs.readFileSync(credsPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed?.me?.id) {
              const fullJid = db.normalizeJid(parsed.me.id);
              if (fullJid) jidsToSync.add(fullJid);
            }
            if (parsed?.me?.name) {
              botName = parsed.me.name;
            }
          } catch (_) {}
        }

        // Update database untuk seluruh variasi JID sub-bot agar tidak old
        for (const jid of jidsToSync) {
          db.registerBotJid(jid);
          db.setOwner(jid, true);
          db.updateUser(jid, {
            name: botName,
            owner: true,
            admin: true,
            premium: true,
            registered: true,
          });
        }

        updatedCount++;
        logger?.info?.(`[SubBot Database Sync] Berhasil memperbarui database sub-bot: +${number} (Owner & Premium Aktif)`);
      }
    }

    if (updatedCount > 0) {
      db.save();
    }
  } catch (err) {
    logger?.error?.("[SubBot Database Sync Error]:", err.message);
  }
  return updatedCount;
}

/**
 * Auto restore existing saved sub bot sessions on startup
 */
export async function autoRestoreSubBots() {
  try {
    // 1. Sinkronkan dan perbarui database terlebih dahulu agar database tidak old
    await syncSubBotsDatabase();

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

/**
 * Check if a socket instance belongs to a sub-bot
 */
export function isSubBotSocket(sock) {
  if (!sock) return false;
  if (sock.isSubBot) return true;
  for (const entry of subBots.values()) {
    if (entry.sock === sock) return true;
  }
  return false;
}

/**
 * Check if a phone number or JID is an active/configured sub-bot
 */
export function isSubBotNumber(jidOrPhone) {
  if (!jidOrPhone) return false;
  const digits = String(jidOrPhone).replace(/[^0-9]/g, "");
  if (!digits) return false;
  const botId = `sub_${digits}`;
  if (subBots.has(botId)) return true;
  const sessionDir = path.join(baseSessionsDir, botId);
  if (fs.existsSync(sessionDir)) return true;
  return false;
}
