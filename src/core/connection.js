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
import { fileURLToPath } from "url";
import qrcode from "qrcode-terminal";
import { enqueueMessage } from "@/src/core/queue.js";
import { loadPlugins } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { recordMessage } from "@/src/services/chatlogger.js";
import { startAutoCleanInterval } from "@/src/utils/cleaner.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    },
  },
});

let isPluginsLoaded = false;
let _cleanIntervalStarted = false;
let primarySock = null;
let isStarting = false;
let reconnectTimer = null;
let lastDisconnectAt = 0;

export function getPrimarySock() {
  return primarySock;
}

export async function startBot() {
  if (isStarting) {
    logger.warn("startBot is already initializing in the background. Skipping redundant call.");
    return primarySock;
  }
  isStarting = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (primarySock) {
    try {
      primarySock.ev.removeAllListeners("connection.update");
      primarySock.ev.removeAllListeners("messages.upsert");
      primarySock.ev.removeAllListeners("creds.update");
      primarySock.end();
    } catch (_) { }
    primarySock = null;
  }

  try {
    const activeSettings = db.getSettings();

    if (!isPluginsLoaded) {
      await loadPlugins();
      isPluginsLoaded = true;
    }

    if (!_cleanIntervalStarted) {
      _cleanIntervalStarted = true;
      startAutoCleanInterval(logger);
    }

    const authDir = path.join(__dirname, "..", "..", "assets", "sessions", "primary_bot");
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const credsPath = path.join(authDir, "creds.json");
    if (fs.existsSync(credsPath)) {
      try {
        const stats = fs.statSync(credsPath);
        if (stats.size === 0) {
          throw new Error("creds.json kosong (0 bytes)");
        }
        const parsed = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        if (!parsed || typeof parsed !== "object" || !parsed.noiseKey) {
          throw new Error("Format creds.json tidak lengkap atau korup");
        }
      } catch (err) {
        logger.warn(`Sesi sebelumnya tidak valid (${err.message}). Menghapus sesi lama dan membuat sesi baru yang bersih...`);
        deleteFolderRecursive(authDir);
        fs.mkdirSync(authDir, { recursive: true });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1043857760],
    }));

    logger.info(`Initializing primary Rizzer Bot connection (WA Version: ${version ? version.join('.') : 'default'})...`);

    const usePairingCode = activeSettings.usePairingCode;
    const msgRetryCounterCache = new Map();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: !usePairingCode,
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: activeSettings.autoOnline,
      syncFullHistory: false,
      msgRetryCounterCache,
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid) => jid?.endsWith("@broadcast") && jid !== "status@broadcast",
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: true,
      fireInitQueries: true,
      retryRequestDelayMs: 250,
    });

    primarySock = sock;
    isStarting = false;

    sock.ev.on("creds.update", saveCreds);
    let pairingTimeout = null;

    if (usePairingCode && !sock.authState.creds.registered) {
      const phoneNumber = db.normalizeJid(activeSettings.pairingNumber).split("@")[0];
      if (!phoneNumber) {
        logger.error(
          "Pairing phone number is missing or invalid in database/settings.js!"
        );
      } else {
        const requestPairing = async () => {
          try {
            logger.info(
              `Requesting pairing code for primary bot: ${phoneNumber}...`
            );
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(
              `\n\x1b[36m====================================\x1b[0m`
            );
            console.log(
              `🔑 \x1b[1m\x1b[32mYOUR WHATSAPP PAIRING CODE:\x1b[0m \x1b[1m\x1b[4m\x1b[33m${code}\x1b[0m 🔑`
            );
            console.log(
              `\x1b[36m====================================\x1b[0m\n`
            );
          } catch (err) {
            logger.error(`Failed to request pairing code: ${err.message || err}. Retrying in 5 seconds...`);
            pairingTimeout = setTimeout(requestPairing, 5000);
          }
        };
        pairingTimeout = setTimeout(requestPairing, 3000);
      }
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !usePairingCode) {
        logger.info(
          "New QR Code generated. Scan the code below to pair your WhatsApp account:"
        );
        qrcode.generate(qr, { small: true });
      }

      if (connection === "close") {
        if (pairingTimeout) clearTimeout(pairingTimeout);
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const reason =
          lastDisconnect?.error?.message || lastDisconnect?.error || "Unknown";
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn(
          `Primary connection closed. Reason: ${reason} (Status Code: ${statusCode || "N/A"
          }). Reconnecting: ${shouldReconnect}`
        );

        lastDisconnectAt = Date.now();
        try {
          const { setPrimaryOnline, notifyOwner } = await import("@/src/services/health.js");
          setPrimaryOnline(false);
          if (!shouldReconnect) {
            notifyOwner("Peringatan: primary bot logout, perlu pairing ulang.").catch(() => {});
          }
        } catch (_) {}

        if (shouldReconnect) {
          logger.info("Attempting to reconnect primary in 5 seconds...");
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startBot().catch((err) => {
              logger.error("Failed to restart primary bot:", err);
            });
          }, 5000);
        } else {
          logger.error("Log out detected. Cleaning up primary session files...");
          try {
            deleteFolderRecursive(authDir);
          } catch (e) {
            logger.error(
              "Failed to delete corrupted primary session:",
              e.message
            );
          }
          logger.info(
            "Re-initializing bot connection with fresh state in 3 seconds..."
          );
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startBot().catch((err) => {
              logger.error("Failed to restart primary bot with fresh state:", err);
            });
          }, 3000);
        }
      } else if (connection === "open") {
      logger.info("Primary Rizzer Bot successfully connected and is now online!");
      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/health.js");
        setPrimaryOnline(true);
        if (lastDisconnectAt && Date.now() - lastDisconnectAt > 60 * 1000) {
          const menit = Math.round((Date.now() - lastDisconnectAt) / 60000);
          notifyOwner(`Primary bot kembali online setelah down ±${menit} menit.`).catch(() => {});
        }
      } catch (_) {}
      lastDisconnectAt = 0;
      if (sock.user?.id) {
        db.registerBotJid(sock.user.id);
        try {
          if (typeof db.setMainBotJid === "function") db.setMainBotJid(sock.user.id);
        } catch (_) {}
      }
      }
    });

  sock.isSubBot = false;
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
        const rjid = msg.key.remoteJid;
        if (rjid === "status@broadcast") continue;
        if (rjid.endsWith("@newsletter") || rjid.endsWith("@broadcast")) continue;
        if (msg.message) {
          const keys = Object.keys(msg.message);
          if (keys.length === 1 && (keys[0] === "protocolMessage" || keys[0] === "reactionMessage" || keys[0] === "pollUpdateMessage")) continue;
        }
        try {
          const ts = Number(msg.messageTimestamp);
          if (Number.isFinite(ts) && ts > 0 && Date.now() - ts * 1000 > 2 * 60 * 1000) continue;
        } catch (_) {}

        if (db.getSettings().autoRead) {
          await sock.readMessages([msg.key]).catch(() => { });
        }
        try {
          recordMessage(sock, msg);
        } catch (_) {}
        enqueueMessage(sock, msg, logger);
      } catch (err) {
        logger.error("Error in primary message handler:", err);
      }
    }
  });

    return sock;
  } catch (error) {
    isStarting = false;
    logger.error("Fatal error during startBot initialization:", error);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startBot().catch(() => { });
    }, 5000);
    return null;
  }
}

export default startBot;
