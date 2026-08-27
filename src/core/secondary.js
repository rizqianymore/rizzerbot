import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  BufferJSON,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { enqueueMessage } from "@/src/core/queue.js";
import { settings } from "@/config/settings.js";
import { registerGroupGuard } from "@/src/middleware/groupGuard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runningBots = new Map();
const reconnectTimers = new Map();

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Cek apakah bot dengan nomor tersebut benar-benar aktif & responsif
 */
export async function isBotActive(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  const authDirName = `session_${cleanNumber}`;
  const sock = runningBots.get(authDirName);

  if (!sock) return false;
  if (!sock.user?.id || !sock.authState?.creds?.registered) return false;

  try {
    const isOnline = sock.ws?.isOpen || sock.ws?.readyState === 1;
    return isOnline;
  } catch (_) {
    return false;
  }
}

export async function addSecondaryBot(phoneNumber, logger) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  if (!cleanNumber || cleanNumber.length < 7) {
    throw new Error("Nomor telepon tidak valid! Minimal 7 digit angka.");
  }

  const authDirName = `session_${cleanNumber}`;
  const sessionsDir = path.join(__dirname, "..", "..", "assets", "sessions");
  const authDir = path.join(sessionsDir, authDirName);

  // 1. Cek apakah bot saat ini sedang aktif & responsif di memori
  const existingSock = runningBots.get(authDirName);
  if (existingSock) {
    const active = await isBotActive(cleanNumber);
    if (active) {
      if (logger) logger.info(`Secondary bot ${cleanNumber} is already active & responsive.`);
      return null;
    }
    if (logger) logger.warn(`Secondary bot ${cleanNumber} in memory is inactive/stale. Purging...`);
    await stopSecondaryBot(cleanNumber, false, logger);
  }

  // 2. Cek apakah folder sesi ada di filesystem dan valid sesuai Baileys auth
  if (fs.existsSync(authDir)) {
    const credsPath = path.join(authDir, "creds.json");
    let hasValidRegisteredCreds = false;

    if (fs.existsSync(credsPath)) {
      try {
        const raw = fs.readFileSync(credsPath, "utf8");
        const creds = JSON.parse(raw, BufferJSON.reviver);
        if (creds && creds.registered && creds.me?.id) {
          hasValidRegisteredCreds = true;
        }
      } catch (_) {}
    }

    if (!hasValidRegisteredCreds) {
      if (logger) logger.warn(`Session folder for ${cleanNumber} exists but is unregistered/corrupted. Deleting for fresh pairing...`);
      deleteFolderRecursive(authDir);
    }
  }

  // 3. Clear existing reconnect timer
  if (reconnectTimers.has(authDirName)) {
    clearTimeout(reconnectTimers.get(authDirName));
    reconnectTimers.delete(authDirName);
  }

  if (logger) logger.info(`Starting fresh secondary bot session for: ${cleanNumber}`);
  const code = await startSecondaryBot(authDirName, cleanNumber, logger);
  return code;
}

export async function stopSecondaryBot(phoneNumber, deleteSession = true, logger) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  const authDirName = `session_${cleanNumber}`;

  // Clear reconnect timer
  if (reconnectTimers.has(authDirName)) {
    clearTimeout(reconnectTimers.get(authDirName));
    reconnectTimers.delete(authDirName);
  }

  const sock = runningBots.get(authDirName);
  if (sock) {
    try {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("messages.upsert");
      sock.ev.removeAllListeners("creds.update");
      if (deleteSession) {
        sock.logout().catch(() => {});
      }
      sock.end();
    } catch (_) {}
    runningBots.delete(authDirName);
  }

  if (deleteSession) {
    const authDir = path.join(__dirname, "..", "..", "assets", "sessions", authDirName);
    deleteFolderRecursive(authDir);
  }

  if (logger) {
    logger.info(`Stopped ${deleteSession ? "and deleted " : ""}secondary bot session for: ${cleanNumber}`);
  }
}

export async function startSecondaryBot(authDirName, phoneNumber, logger) {
  const sessionsDir = path.join(__dirname, "..", "..", "assets", "sessions");
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  const authDir = path.join(sessionsDir, authDirName);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1043857760],
  }));

  // Clear reconnect timer for this bot if one is running
  if (reconnectTimers.has(authDirName)) {
    clearTimeout(reconnectTimers.get(authDirName));
    reconnectTimers.delete(authDirName);
  }

  const oldSock = runningBots.get(authDirName);
  if (oldSock) {
    try {
      oldSock.ev.removeAllListeners("connection.update");
      oldSock.ev.removeAllListeners("messages.upsert");
      oldSock.ev.removeAllListeners("creds.update");
      oldSock.end();
    } catch (_) {}
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: settings.autoOnline ?? true,
    syncFullHistory: false,
    keepAliveIntervalMs: 30000,
  });

  sock.ev.on("creds.update", saveCreds);
  registerGroupGuard(sock);

  let pairingTimeout = null;

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      if (pairingTimeout) clearTimeout(pairingTimeout);

      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (logger) {
        logger.warn(
          `Secondary bot ${phoneNumber} connection closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`
        );
      }

      if (shouldReconnect) {
        const timer = setTimeout(() => {
          reconnectTimers.delete(authDirName);
          startSecondaryBot(authDirName, phoneNumber, logger).catch((err) => {
            if (logger) logger.error(`Error reconnecting secondary bot ${phoneNumber}:`, err);
          });
        }, 5000);
        reconnectTimers.set(authDirName, timer);
      } else {
        runningBots.delete(authDirName);
        deleteFolderRecursive(authDir);
        if (logger) {
          logger.info(`Secondary bot session ${phoneNumber} logged out and removed.`);
        }
      }
    } else if (connection === "open") {
      if (pairingTimeout) clearTimeout(pairingTimeout);
      runningBots.set(authDirName, sock);
      if (logger) {
        logger.info(`Secondary bot ${phoneNumber} successfully connected and online!`);
      }
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
        enqueueMessage(sock, msg, logger);
      } catch (err) {
        if (logger) {
          logger.error(`Error in secondary bot message handler (${phoneNumber}):`, err);
        }
      }
    }
  });

  if (!sock.authState.creds.registered) {
    return new Promise((resolve, reject) => {
      let isResolved = false;

      const finishResolve = (code) => {
        if (!isResolved) {
          isResolved = true;
          if (pairingTimeout) clearTimeout(pairingTimeout);
          runningBots.set(authDirName, sock);
          resolve(code);
        }
      };

      const finishReject = (err) => {
        if (!isResolved) {
          isResolved = true;
          if (pairingTimeout) clearTimeout(pairingTimeout);
          runningBots.delete(authDirName);
          deleteFolderRecursive(authDir);
          reject(err);
        }
      };

      const requestPairing = async (retryCount = 0) => {
        try {
          if (logger) {
            logger.info(`Requesting pairing code for secondary bot ${phoneNumber} (attempt ${retryCount + 1})...`);
          }
          const code = await sock.requestPairingCode(phoneNumber);
          if (logger) {
            logger.info(`Successfully generated pairing code for ${phoneNumber}: ${code}`);
          }
          finishResolve(code);
        } catch (err) {
          if (retryCount < 2) {
            if (logger) {
              logger.warn(`Pairing request attempt ${retryCount + 1} failed (${err.message}). Retrying in 2 seconds...`);
            }
            pairingTimeout = setTimeout(() => requestPairing(retryCount + 1), 2000);
          } else {
            finishReject(err);
          }
        }
      };

      const maxTimeout = setTimeout(() => {
        finishReject(new Error("Timeout: Gagal mendapatkan pairing code dari server WhatsApp setelah 20 detik."));
      }, 20000);

      pairingTimeout = setTimeout(() => requestPairing(0), 1500);
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
        const authDir = path.join(sessionsParentDir, folder);
        const credsPath = path.join(authDir, "creds.json");

        if (fs.existsSync(credsPath)) {
          try {
            const raw = fs.readFileSync(credsPath, "utf8");
            const creds = JSON.parse(raw, BufferJSON.reviver);
            if (!creds || !creds.registered) {
              if (logger) logger.warn(`Pruning uncompleted session folder ${folder}...`);
              deleteFolderRecursive(authDir);
              continue;
            }
          } catch (_) {
            if (logger) logger.warn(`Pruning invalid JSON in session folder ${folder}...`);
            deleteFolderRecursive(authDir);
            continue;
          }
        } else {
          deleteFolderRecursive(authDir);
          continue;
        }

        if (logger) {
          logger.info(`Restoring secondary bot session for number: ${secNumber}...`);
        }
        startSecondaryBot(folder, secNumber, logger).catch((err) => {
          if (logger) {
            logger.error(`Failed to restore secondary session ${secNumber}:`, err);
          }
        });
      }
    }
  }
}
