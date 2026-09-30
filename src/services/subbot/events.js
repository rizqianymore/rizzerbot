import { Boom } from "@hapi/boom";
import { DisconnectReason } from "baileys";
import { enqueueMessage } from "@/src/core/queue.js";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { subBots } from "./store.js";

/**
 * Setup Baileys event handlers for a sub-bot
 */
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

  // Connection update event
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      botEntry.status = "online";
      logger.info(`[SubBot ${cleanNumber}] Connected successfully!`);
      const botUserJid = db.normalizeJid(sock.user?.id) || `${cleanNumber}@s.whatsapp.net`;
      db.registerBotJid(botUserJid);

      // Ambil pengaturan yang sudah ada untuk cleanNumber atau botUserJid
      const existingSettings = db.getBotSettings(`${cleanNumber}@s.whatsapp.net`);

      // Inisialisasi pengaturan mandiri untuk sub-bot
      db.updateBotSettings(botUserJid, {
        botName: sock.user?.name || existingSettings.botName || `SubBot (+${cleanNumber})`,
        ownerNumber: existingSettings.ownerNumber || `${cleanNumber}@s.whatsapp.net`,
        ownerNumbers: existingSettings.ownerNumbers || [],
        public: existingSettings.public,
        prefix: existingSettings.prefix,
      });
      db.updateUser(botUserJid, {
        name: sock.user?.name || `SubBot (+${cleanNumber})`,
        registered: true,
      });
      logger.info(`[SubBot ${cleanNumber}] Berhasil online dengan pengaturan mandiri.`);
    } else if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        `[SubBot ${cleanNumber}] Connection closed (status: ${statusCode}). Reconnect: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        botEntry.status = "reconnecting";
        setTimeout(() => {
          reconnectFn().catch(() => {});
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

  // Message dispatcher queue
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
      enqueueMessage(sock, msg, logger);
    }
  });
}
