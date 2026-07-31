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
import { handleMessage } from "@/lib/handler.js";
import { loadPlugins } from "@/lib/plugins.js";
import { settings } from "@/config/settings.js";
import { db } from "@/lib/database.js";
import { registerGroupGuard } from "@/src/middleware/groupGuard.js";
import { startAutoCleanInterval } from "@/src/utils/cleaner.js";
import {
  addSecondaryBot,
  stopSecondaryBot,
  restoreSecondarySessions,
  runningBots,
} from "@/src/core/secondary.js";

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

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

export async function startBot() {
  if (!isPluginsLoaded) {
    await loadPlugins();
    isPluginsLoaded = true;
    db.ensurePrivilegedUsers();
  }

  if (!_cleanIntervalStarted) {
    _cleanIntervalStarted = true;
    startAutoCleanInterval(logger);
  }

  const authDir = path.join(__dirname, "..", "..", "assets", "sessions", "primary_bot");
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: undefined,
  }));

  logger.info("Initializing primary Kyros-MD connection...");

  const usePairingCode = settings.usePairingCode;

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: settings.autoOnline,
    syncFullHistory: false,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on("creds.update", saveCreds);
  registerGroupGuard(sock);
  let pairingTimeout = null;

  if (usePairingCode && !sock.authState.creds.registered) {
    const phoneNumber = settings.pairingNumber?.replace(/[^0-9]/g, "");
    if (!phoneNumber) {
      logger.error(
        "Pairing phone number is missing or invalid in settings.js!"
      );
    } else {
      pairingTimeout = setTimeout(async () => {
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
          logger.error("Failed to request pairing code:", err.message || err);
        }
      }, 3000);
    }
  }

  sock.ev.on("connection.update", (update) => {
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
        `Primary connection closed. Reason: ${reason} (Status Code: ${
          statusCode || "N/A"
        }). Reconnecting: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        logger.info("Attempting to reconnect primary in 5 seconds...");
        setTimeout(() => {
          startBot();
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
        setTimeout(() => {
          startBot();
        }, 3000);
      }
    } else if (connection === "open") {
      logger.info("Primary Kyros-MD successfully connected and is now online!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;

        if (settings.autoRead) {
          await sock.readMessages([msg.key]).catch(() => {});
        }
        await handleMessage(sock, msg, logger);
      } catch (err) {
        logger.error("Error in primary message handler middleware:", err);
      }
    }
  });

  restoreSecondarySessions(logger);
  return sock;
}

export { addSecondaryBot, stopSecondaryBot, runningBots };
