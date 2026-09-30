import makeWASocket, {
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
} from "baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { subBots, baseSessionsDir } from "./store.js";
import { setupSubBotEvents } from "./events.js";

/**
 * Start a new sub bot instance with phone number pairing code
 */
export async function createSubBot(number, onPairingCode, assignedOwner = null) {
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

  const targetJid = `${cleanNumber}@s.whatsapp.net`;
  db.registerBotJid(targetJid);
  // Buatkan database SENDIRI untuk sub-bot (seed sekali; tidak menimpa yang sudah ada).
  const seed = {
    botName: `SubBot (+${cleanNumber})`,
  };
  if (assignedOwner) {
    const normOwner = db.normalizeJid(assignedOwner);
    if (normOwner) seed.ownerNumber = normOwner;
  }
  db.ensureSubStore(targetJid, seed);

  setupSubBotEvents({
    sock,
    botEntry,
    cleanNumber,
    botId,
    sessionDir,
    saveCreds,
    onPairingCode,
    reconnectFn: () => createSubBot(cleanNumber, onPairingCode, assignedOwner),
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
