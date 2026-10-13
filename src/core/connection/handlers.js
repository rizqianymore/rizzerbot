import { Boom } from "@hapi/boom";
import { DisconnectReason } from "baileys";
import qrcode from "qrcode-terminal";
import { db } from "@/src/core/database.js";
import { enqueueMessage } from "@/src/core/queue.js";
import { recordMessage } from "@/src/services/system/chatlogger.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { logger } from "./logger.js";
import { connectionState } from "./state.js";

export function attachConnectionEvents(sock, { authDir, usePairingCode, timers, restart }) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !usePairingCode) {
      logger.info("New QR Code generated. Scan the code below to pair your WhatsApp account:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      if (timers.pairingTimeout) clearTimeout(timers.pairingTimeout);
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || lastDisconnect?.error || "Unknown";
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        `Primary connection closed. Reason: ${reason} (Status Code: ${
          statusCode || "N/A"
        }). Reconnecting: ${shouldReconnect}`
      );

      connectionState.lastDisconnectAt = Date.now();
      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/system/health.js");
        setPrimaryOnline(false);
        if (!shouldReconnect) {
          notifyOwner("Peringatan: primary bot logout, perlu pairing ulang.").catch(() => {});
        }
      } catch (_) {}

      if (shouldReconnect) {
        logger.info("Attempting to reconnect primary in 5 seconds...");
        if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
        connectionState.reconnectTimer = setTimeout(() => {
          connectionState.reconnectTimer = null;
          restart().catch((err) => {
            logger.error("Failed to restart primary bot:", err);
          });
        }, 5000);
      } else {
        logger.error("Log out detected. Cleaning up primary session files...");
        try {
          deleteFolderRecursive(authDir);
        } catch (e) {
          logger.error("Failed to delete corrupted primary session:", e.message);
        }
        logger.info("Re-initializing bot connection with fresh state in 3 seconds...");
        if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
        connectionState.reconnectTimer = setTimeout(() => {
          connectionState.reconnectTimer = null;
          restart().catch((err) => {
            logger.error("Failed to restart primary bot with fresh state:", err);
          });
        }, 3000);
      }
    } else if (connection === "open") {
      logger.info("Primary Rizzer Bot successfully connected and is now online!");
      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/system/health.js");
        setPrimaryOnline(true);
        if (connectionState.lastDisconnectAt && Date.now() - connectionState.lastDisconnectAt > 60 * 1000) {
          const menit = Math.round((Date.now() - connectionState.lastDisconnectAt) / 60000);
          notifyOwner(`Primary bot kembali online setelah down ±${menit} menit.`).catch(() => {});
        }
      } catch (_) {}
      connectionState.lastDisconnectAt = 0;
      if (sock.user?.id) {
        db.registerBotJid(sock.user.id);
        try {
          if (typeof db.setMainBotJid === "function") db.setMainBotJid(sock.user.id);
        } catch (_) {}
      }
    }
  });
}

export function attachMessageHandler(sock) {
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
          if (
            keys.length === 1 &&
            (keys[0] === "protocolMessage" || keys[0] === "reactionMessage" || keys[0] === "pollUpdateMessage")
          )
            continue;
        }
        try {
          const ts = Number(msg.messageTimestamp);
          if (Number.isFinite(ts) && ts > 0 && Date.now() - ts * 1000 > 2 * 60 * 1000) continue;
        } catch (_) {}

        if (db.getSettings().autoRead) {
          await sock.readMessages([msg.key]).catch(() => {});
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
}
