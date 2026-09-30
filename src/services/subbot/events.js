import { Boom } from "@hapi/boom";
import { DisconnectReason } from "baileys";
import { enqueueMessage } from "@/src/core/queue.js";
import { logger } from "@/src/core/connection.js";
import { db } from "@/src/core/database.js";
import { deleteFolderRecursive } from "@/src/utils/helper.js";
import { subBots } from "./store.js";

function shouldSkipBeforeQueue(msg) {
  if (!msg?.key?.id || !msg?.key?.remoteJid) return true;
  const rjid = msg.key.remoteJid;
  if (rjid === "status@broadcast") return true;
  if (rjid.endsWith("@newsletter") || rjid.endsWith("@broadcast")) return true;
  // Pesan sistem (hapus/reaction/poll-update) tidak perlu masuk antrean
  if (msg.message) {
    const keys = Object.keys(msg.message);
    if (keys.length === 1 && (keys[0] === "protocolMessage" || keys[0] === "reactionMessage" || keys[0] === "pollUpdateMessage")) {
      return true;
    }
  }
  // Pesan basi (>2 menit) dari riwayat/reconnect -> abaikan agar tidak loop spam
  try {
    const ts = Number(msg.messageTimestamp);
    if (Number.isFinite(ts) && ts > 0 && Date.now() - ts * 1000 > 2 * 60 * 1000) return true;
  } catch (_) {}
  return false;
}

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
      // Daftarkan juga varian nomor bersih agar deteksi bot lintas format (lid/device) akurat
      db.registerBotJid(`${cleanNumber}@s.whatsapp.net`);

      // ISOLASI SETTING: jangan overwrite public/prefix/owner yang sudah diatur
      // owner sub via DM. Hanya inisialisasi sekali jika belum ada.
      try {
        const stored = db.data?.botSettings?.[botUserJid];
        const storedAlt = db.data?.botSettings?.[db.normalizeJid(`${cleanNumber}@s.whatsapp.net`)];
        const existing = stored || storedAlt;
        if (!existing) {
          db.updateBotSettings(botUserJid, {
            botName: sock.user?.name || `SubBot (+${cleanNumber})`,
            ownerNumber: `${cleanNumber}@s.whatsapp.net`,
            ownerNumbers: [],
          });
        } else {
          // Samakan alias JID agar lookup konsisten, tanpa merusak setting mandiri
          if (!stored && storedAlt) {
            db.updateBotSettings(botUserJid, {
              botName: sock.user?.name || storedAlt.botName || `SubBot (+${cleanNumber})`,
            });
          } else if (sock.user?.name) {
            db.updateUser(botUserJid, { name: sock.user.name, registered: true });
          }
        }
      } catch (_) {
        try {
          db.updateBotSettings(botUserJid, {
            botName: sock.user?.name || `SubBot (+${cleanNumber})`,
          });
        } catch (_) {}
      }
      try {
        db.updateUser(botUserJid, {
          name: sock.user?.name || `SubBot (+${cleanNumber})`,
          registered: true,
        });
      } catch (_) {}
      logger.info(`[SubBot ${cleanNumber}] Berhasil online dengan pengaturan mandiri (self/public/prefix terisolasi).`);
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

  // Message dispatcher queue (dengan filter dini anti-loop)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (shouldSkipBeforeQueue(msg)) continue;
      if (db.getSettings().autoRead) {
        try { await sock.readMessages([msg.key]).catch(() => {}); } catch (_) {}
      }
      enqueueMessage(sock, msg, logger);
    }
  });
}
