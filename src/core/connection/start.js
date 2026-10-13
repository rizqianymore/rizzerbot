import makeWASocket, { useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } from "ourin-baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { loadPlugins } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { startAutoCleanInterval } from "@/src/utils/cleaner.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { logger } from "./logger.js";
import { connectionState } from "./state.js";
import { attachConnectionEvents, attachMessageHandler } from "./handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startBot() {
  if (connectionState.isStarting) {
    logger.warn("startBot is already initializing in the background. Skipping redundant call.");
    return connectionState.primarySock;
  }
  connectionState.isStarting = true;

  if (connectionState.reconnectTimer) {
    clearTimeout(connectionState.reconnectTimer);
    connectionState.reconnectTimer = null;
  }

  if (connectionState.primarySock) {
    try {
      connectionState.primarySock.ev.removeAllListeners("connection.update");
      connectionState.primarySock.ev.removeAllListeners("messages.upsert");
      connectionState.primarySock.ev.removeAllListeners("creds.update");
      connectionState.primarySock.end();
    } catch (_) {}
    connectionState.primarySock = null;
  }

  try {
    const activeSettings = db.getSettings();

    if (!connectionState.isPluginsLoaded) {
      await loadPlugins();
      connectionState.isPluginsLoaded = true;
    }

    if (!connectionState.cleanIntervalStarted) {
      connectionState.cleanIntervalStarted = true;
      startAutoCleanInterval(logger);
    }

    const authDir = path.join(__dirname, "..", "..", "..", "assets", "sessions", "primary_bot");
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
        logger.warn(
          `Sesi sebelumnya tidak valid (${err.message}). Menghapus sesi lama dan membuat sesi baru yang bersih...`
        );
        deleteFolderRecursive(authDir);
        fs.mkdirSync(authDir, { recursive: true });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1043857760],
    }));

    logger.info(
      `Initializing primary Rizzer Bot connection (WA Version: ${version ? version.join(".") : "default"})...`
    );

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

    connectionState.primarySock = sock;

    sock.ev.on("creds.update", saveCreds);
    const timers = { pairingTimeout: null };

    if (usePairingCode && !sock.authState.creds.registered) {
      const phoneNumber = db.normalizeJid(activeSettings.pairingNumber).split("@")[0];
      if (!phoneNumber) {
        logger.error("Pairing phone number is missing or invalid in database/settings.js!");
      } else {
        const requestPairing = async () => {
          try {
            logger.info(`Requesting pairing code for primary bot: ${phoneNumber}...`);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n\x1b[36m====================================\x1b[0m`);
            console.log(`🔑 \x1b[1m\x1b[32mYOUR WHATSAPP PAIRING CODE:\x1b[0m \x1b[1m\x1b[4m\x1b[33m${code}\x1b[0m 🔑`);
            console.log(`\x1b[36m====================================\x1b[0m\n`);
          } catch (err) {
            logger.error(`Failed to request pairing code: ${err.message || err}. Retrying in 5 seconds...`);
            timers.pairingTimeout = setTimeout(requestPairing, 5000);
          }
        };
        timers.pairingTimeout = setTimeout(requestPairing, 3000);
      }
    }

    attachConnectionEvents(sock, { authDir, usePairingCode, timers, restart: () => startBot() });

    sock.isSubBot = false;
    attachMessageHandler(sock);

    connectionState.isStarting = false;
    return sock;
  } catch (error) {
    connectionState.isStarting = false;
    logger.error("Fatal error during startBot initialization:", error);
    if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
    connectionState.reconnectTimer = setTimeout(() => {
      connectionState.reconnectTimer = null;
      startBot().catch(() => {});
    }, 5000);
    return null;
  }
}
