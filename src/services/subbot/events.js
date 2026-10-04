import { Boom } from "@hapi/boom";
import { DisconnectReason } from "baileys";
import { enqueueMessage } from "@/src/core/queue.js";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { recordMessage } from "@/src/services/chatlogger.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { subBots } from "./store.js";

function shouldSkipBeforeQueue(msg) {
  if (!msg?.key?.id || !msg?.key?.remoteJid) return true;
  const rjid = msg.key.remoteJid;
  if (rjid === "status@broadcast") return true;
  if (rjid.endsWith("@newsletter") || rjid.endsWith("@broadcast")) return true;

  if (msg.message) {
    const keys = Object.keys(msg.message);
    if (keys.length === 1 && (keys[0] === "protocolMessage" || keys[0] === "reactionMessage" || keys[0] === "pollUpdateMessage")) {
      return true;
    }
  }

  try {
    const ts = Number(msg.messageTimestamp);
    if (Number.isFinite(ts) && ts > 0 && Date.now() - ts * 1000 > 2 * 60 * 1000) return true;
  } catch (_) { }
  return false;
}

export function setupSubBotEvents({
  sock,
  botEntry,
  cleanNumber,
  botId,
  sessionDir,
  saveCreds,
  onPairingCode,
  reconnectFn,
}) {
  sock.ev.on("creds.update", saveCreds);

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

      db.registerBotJid(`${cleanNumber}@s.whatsapp.net`);

      try {
        db.ensureSubStore(botUserJid, {
          botName: sock.user?.name || `SubBot (+${cleanNumber})`,
        });
        db.runWithBot(botUserJid, () => {
          db.updateUser(botUserJid, {
            name: sock.user?.name || `SubBot (+${cleanNumber})`,
            registered: true,
          });
        });
      } catch (_) { }
      logger.info(`[SubBot ${cleanNumber}] Berhasil online dengan database sendiri (terisolasi).`);
    } else if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        `[SubBot ${cleanNumber}] Connection closed (status: ${statusCode}). Reconnect: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        botEntry.status = "reconnecting";
        setTimeout(() => {
          reconnectFn().catch(() => { });
        }, 5000);
      } else {
        botEntry.status = "disconnected";
        subBots.delete(botId);
        try {
          const { notifyOwner } = await import("@/src/services/health.js");
          notifyOwner(`Subbot ${cleanNumber} logout, sesi dihapus.`).catch(() => {});
        } catch (_) {}
        try {
          deleteFolderRecursive(sessionDir);
        } catch (_) { }
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const subJid = `${cleanNumber}@s.whatsapp.net`;
    for (const msg of messages) {
      if (shouldSkipBeforeQueue(msg)) continue;

      const autoRead = db.runWithBot(subJid, () => db.getSettings().autoRead);
      if (autoRead) {
        try { await sock.readMessages([msg.key]).catch(() => { }); } catch (_) { }
      }
      try {
        recordMessage(sock, msg);
      } catch (_) {}
      enqueueMessage(sock, msg, logger);
    }
  });
}
