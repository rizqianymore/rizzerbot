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
import { handleMessage } from "@/lib/handler.js";
import { settings } from "@/config/settings.js";
import { registerGroupGuard } from "@/src/middleware/groupGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runningBots = new Map();

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

export async function addSecondaryBot(phoneNumber, logger) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  if (!cleanNumber) throw new Error("Nomor telepon tidak valid!");

  const authDirName = `session_${cleanNumber}`;
  if (logger) logger.info(`Starting secondary bot for: ${cleanNumber}`);
  const code = await startSecondaryBot(authDirName, cleanNumber, logger);
  return code;
}

export async function stopSecondaryBot(phoneNumber, logger) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  const authDirName = `session_${cleanNumber}`;
  const sock = runningBots.get(authDirName);

  if (sock) {
    try {
      sock.logout();
    } catch (_) {}
    try {
      sock.end();
    } catch (_) {}
    runningBots.delete(authDirName);
  }

  const authDir = path.join(__dirname, "..", "..", "assets", "sessions", authDirName);
  deleteFolderRecursive(authDir);
  if (logger) logger.info(`Stopped and deleted secondary bot session for: ${cleanNumber}`);
}

export async function startSecondaryBot(authDirName, phoneNumber, logger) {
  const sessionsDir = path.join(__dirname, "..", "..", "assets", "sessions");
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  const authDir = path.join(sessionsDir, authDirName);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: settings.autoOnline,
    syncFullHistory: false,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on("creds.update", saveCreds);
  registerGroupGuard(sock);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (logger) {
        logger.warn(
          `Secondary bot ${phoneNumber} connection closed. Reconnecting: ${shouldReconnect}`
        );
      }

      if (shouldReconnect) {
        setTimeout(() => {
          startSecondaryBot(authDirName, phoneNumber, logger);
        }, 5000);
      } else {
        runningBots.delete(authDirName);
        if (logger) {
          logger.info(
            `Secondary bot session ${phoneNumber} logged out and stopped.`
          );
        }
      }
    } else if (connection === "open") {
      if (logger) {
        logger.info(
          `Secondary bot ${phoneNumber} successfully connected and online!`
        );
      }
      runningBots.set(authDirName, sock);
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
        if (logger) {
          logger.error(
            `Error in secondary bot message handler (${phoneNumber}):`,
            err
          );
        }
      }
    }
  });

  if (!sock.authState.creds.registered) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          if (logger) {
            logger.info(
              `Requesting pairing code for secondary bot ${phoneNumber}...`
            );
          }
          const code = await sock.requestPairingCode(phoneNumber);
          runningBots.set(authDirName, sock);
          resolve(code);
        } catch (err) {
          reject(err);
        }
      }, 3000);
    });
  } else {
    runningBots.set(authDirName, sock);
    return null;
  }
}

export function restoreSecondarySessions(logger) {
  const sessionsParentDir = path.join(__dirname, "..", "..", "assets", "sessions");
  if (fs.existsSync(sessionsParentDir)) {
    const folders = fs.readdirSync(sessionsParentDir);
    for (const folder of folders) {
      const match = folder.match(/^session_([0-9]+)$/);
      if (match) {
        const secNumber = match[1];
        if (logger) {
          logger.info(
            `Restoring secondary bot session for number: ${secNumber}...`
          );
        }
        startSecondaryBot(folder, secNumber, logger).catch((err) => {
          if (logger) {
            logger.error(
              `Failed to restore secondary session ${secNumber}:`,
              err
            );
          }
        });
      }
    }
  }
}
