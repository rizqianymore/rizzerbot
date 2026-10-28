import makeWASocket, { useMultiFileAuthState, Browsers } from "ourin-baileys";
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
import { startKeepAlive, startStabilityWatchdog } from "./keepalive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STABLE_WA_VERSION = [2, 3000, 1043857760];

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
    connectionState.keepAliveStop?.();
  } catch (_) {}
  connectionState.keepAliveStop = null;
  try {
    connectionState.stabilityStop?.();
  } catch (_) {}
  connectionState.stabilityStop = null;

  try {
    const activeSettings = db.getSettings();

    if (!connectionState.isPluginsLoaded) {
      loadPlugins().then(() => {
        connectionState.isPluginsLoaded = true;
      }).catch((e) => logger.error("Plugin load error:", e));
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
          throw new Error("creds.json kosong");
        }
        const parsed = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        if (!parsed || typeof parsed !== "object" || !parsed.noiseKey) {
          throw new Error("Format creds.json korup");
        }
      } catch (err) {
        logger.warn(`Sesi lama tidak valid (${err.message}). Menghapus sesi lama...`);
        deleteFolderRecursive(authDir);
        fs.mkdirSync(authDir, { recursive: true });
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    logger.info(
      `Initializing Rizzer Bot connection (WA Version: ${STABLE_WA_VERSION.join(".")})...`
    );

    const usePairingCode = activeSettings.usePairingCode;
    const msgRetryCounterCache = new Map();

    const sock = makeWASocket({
      version: STABLE_WA_VERSION,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: !usePairingCode,
      browser: Browsers.ubuntu("Chrome"), // Ubuntu Chrome standar Baileys yang 100% cocok dengan pairing
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
      retryRequestDelayMs: 500,
      autoFollowNewsletterOnConnect: false,
    });

    connectionState.primarySock = sock;

    sock.ev.on("creds.update", saveCreds);
    const timers = { pairingTimeout: null };

    // Request Pairing Code: JANGAN minta ulang jika sudah pernah meminta kode di sesi ini
    if (usePairingCode && !sock.authState?.creds?.registered) {
      const rawNumber = activeSettings.pairingNumber || activeSettings.ownerNumber;
      const phoneNumber = String(rawNumber || "").replace(/\D/g, "");

      if (!phoneNumber || phoneNumber.length < 8) {
        logger.error("Nomor pairing tidak valid di config/settings.js!");
      } else {
        const requestPairing = async () => {
          if (sock.authState?.creds?.registered) {
            return;
          }
          // Jika sudah ada pairingCode yang aktif di creds.json, tampilkan kode yang SAMA agar tidak invalid!
          if (sock.authState?.creds?.pairingCode) {
            const existingCode = sock.authState.creds.pairingCode;
            console.log(`\n\x1b[36m====================================\x1b[0m`);
            console.log(`🔑 \x1b[1m\x1b[32mYOUR WHATSAPP PAIRING CODE:\x1b[0m \x1b[1m\x1b[4m\x1b[33m${existingCode}\x1b[0m 🔑`);
            console.log(`\x1b[0m   Masukkan di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon.\n`);
            console.log(`\x1b[36m====================================\x1b[0m\n`);
            return;
          }

          try {
            logger.info(`Meminta kode pairing untuk: +${phoneNumber}...`);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n\x1b[36m====================================\x1b[0m`);
            console.log(`🔑 \x1b[1m\x1b[32mYOUR WHATSAPP PAIRING CODE:\x1b[0m \x1b[1m\x1b[4m\x1b[33m${code}\x1b[0m 🔑`);
            console.log(`\x1b[0m   Masukkan di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon.\n`);
            console.log(`\x1b[36m====================================\x1b[0m\n`);
          } catch (err) {
            logger.warn(`Gagal meminta kode pairing (${err?.message || err}). Mencoba lagi dalam 10 detik...`);
            timers.pairingTimeout = setTimeout(requestPairing, 10000);
          }
        };

        // Tunggu 3 detik agar handshake awal Baileys siap
        timers.pairingTimeout = setTimeout(requestPairing, 3000);
      }
    }

    attachConnectionEvents(sock, { authDir, usePairingCode, timers, restart: () => startBot() });

    sock.isSubBot = false;
    attachMessageHandler(sock);
    connectionState.keepAliveStop = startKeepAlive(sock, { logger, restart: () => startBot() });
    if (!connectionState.stabilityStop) {
      connectionState.stabilityStop = startStabilityWatchdog({ logger });
    }

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
