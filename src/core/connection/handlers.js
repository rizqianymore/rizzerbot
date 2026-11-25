import { Boom } from "@hapi/boom";
import { DisconnectReason } from "baileys";
import qrcode from "qrcode-terminal";
import { db } from "@/src/core/database.js";
import { enqueueMessage } from "@/src/core/queue.js";
import { attachEchoTracker } from "@/src/core/dispatch/echo.js";
import { deleteFolderRecursive, invalidateGroupMeta } from "@/src/utils/helper.js";
import { handleIncomingStatus } from "@/src/utils/status-saver.js";
import { logger } from "./logger.js";
import { connectionState } from "./state.js";
import {
  recordDecryptionFailure,
  resetSessionIfThresholdReached,
  emergencyResetAllSessions,
  SESSION_FAILURE_THRESHOLD,
} from "@/src/core/session-recovery.js";

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
        `Primary connection closed. Reason: ${reason} (Status Code: ${statusCode || "N/A"
        }). Reconnecting: ${shouldReconnect}`
      );

      connectionState.lastDisconnectAt = Date.now();
      const wasRegistered = Boolean(sock.authState?.creds?.registered);

      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/system/health.js");
        setPrimaryOnline(false);

        if (!shouldReconnect && wasRegistered) {
          notifyOwner("Peringatan: primary bot logout, perlu pairing ulang.").catch(() => { });
        }
      } catch (_) { }

      if (!wasRegistered) {
        const is401Reject = statusCode === DisconnectReason.loggedOut;

        if (is401Reject) {
          connectionState.unregisteredFailures = 0;
          logger.warn(
            `[Pairing] Sesi pairing ditolak WhatsApp (Status 401). Membersihkan sesi lama dan meminta pairing baru...`
          );
          try {
            deleteFolderRecursive(authDir);
          } catch (e) {
            logger.error("Gagal menghapus folder sesi pairing:", e.message);
          }
          if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
          connectionState.reconnectTimer = setTimeout(() => {
            connectionState.reconnectTimer = null;
            restart().catch((err) => {
              logger.error("Gagal inisialisasi sesi pairing baru:", err);
            });
          }, 3000);
          return;
        }

        connectionState.unregisteredFailures = (connectionState.unregisteredFailures || 0) + 1;
        const waitMs = 3000;
        logger.info(
          `Mempertahankan sesi pairing (attempt ${connectionState.unregisteredFailures}). ` +
          `Menghubungkan kembali soket dalam ${waitMs / 1000} detik...`
        );
        if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
        connectionState.reconnectTimer = setTimeout(() => {
          connectionState.reconnectTimer = null;
          restart().catch((err) => {
            logger.error("Gagal menghubungkan kembali soket:", err);
          });
        }, waitMs);
        return;
      }

      if (shouldReconnect) {
        const reconnectDelay = Math.min(1000 * Math.max(1, (connectionState.reconnectAttempts || 1)), 5000);
        connectionState.reconnectAttempts = ((connectionState.reconnectAttempts || 0) % 5) + 1;
        logger.info(`Mencoba menghubungkan kembali (reconnect) dalam ${Math.round(reconnectDelay / 1000)} detik...`);
        if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
        connectionState.reconnectTimer = setTimeout(() => {
          connectionState.reconnectTimer = null;
          restart().catch((err) => {
            logger.error("Gagal restart bot:", err);
          });
        }, reconnectDelay);
        return;
      }

      connectionState.unregisteredFailures = 0;
      logger.error("Log out terdeteksi dari WhatsApp. Membersihkan seluruh sesi lama...");
      try {
        deleteFolderRecursive(authDir);
      } catch (e) {
        logger.error("Gagal menghapus folder sesi:", e.message);
      }
      logger.info("Membuat sesi baru dalam 3 detik...");
      if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
      connectionState.reconnectTimer = setTimeout(() => {
        connectionState.reconnectTimer = null;
        restart().catch((err) => {
          logger.error("Gagal inisialisasi sesi baru:", err);
        });
      }, 3000);
    } else if (connection === "open") {
      connectionState.unregisteredFailures = 0;
      connectionState.reconnectAttempts = 0;
      if (timers.pairingTimeout) clearTimeout(timers.pairingTimeout);
      logger.info("🎉 Primary Rizzer Bot BERHASIL TERHUBUNG dan sekarang ONLINE!");
      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/system/health.js");
        setPrimaryOnline(true);
        if (connectionState.lastDisconnectAt && Date.now() - connectionState.lastDisconnectAt > 60 * 1000) {
          const menit = Math.round((Date.now() - connectionState.lastDisconnectAt) / 60000);
          notifyOwner(`Primary bot kembali online setelah down ±${menit} menit.`).catch(() => { });
        }
      } catch (_) { }
      connectionState.lastDisconnectAt = 0;
      if (sock.user?.id) {
        db.registerBotJid(sock.user.id);
        try {
          if (typeof db.setMainBotJid === "function") db.setMainBotJid(sock.user.id);
        } catch (_) { }
      }
    }
  });
}

export function attachWelcomeHandler(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      const jid = update?.id;
      if (!jid || !jid.endsWith("@g.us")) return;

      invalidateGroupMeta(jid, sock);

      if (!db.getGroupSetting?.(jid, "welcome")) return;
      const action = update.action;
      if (action !== "add") return;
      const participants = Array.isArray(update.participants) ? update.participants : [];
      if (!participants.length) return;
      const meta = await sock.groupMetadata(jid).catch(() => null);
      const subject = meta?.subject || jid;
      for (const p of participants) {
        const num = String(p || "").split("@")[0];
        const text = `Halo @${num} 👋\nSelamat datang di *${subject}*!\nBaca deskripsi grup ya.`;
        try {
          await sock.sendMessage(jid, { text, mentions: [p] });
        } catch (err) {
          logger?.warn?.(`[Welcome] Gagal kirim pesan welcome ke ${jid} untuk ${p}: ${err?.message || err}`);
        }
      }
    } catch (_) { }
  });
}

export function attachMessageHandler(sock) {
  attachEchoTracker(sock);
  attachWelcomeHandler(sock);

  sock.ev.on("lid-mapping.update", (mapping) => {
    try {
      if (mapping && typeof mapping === "object") {
        const { lid, pn } = mapping;
        if (lid && pn) db.rememberLidPn(lid, pn);
      }
    } catch (_) { }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      try {
        if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
        const rjid = msg.key.remoteJid;
        if (rjid === "status@broadcast") {
          const autoRead = Boolean(db.getSettings?.()?.autoRead);
          handleIncomingStatus(sock, msg, autoRead).catch(() => { });
          continue;
        }
        if (rjid.endsWith("@newsletter") || rjid.endsWith("@broadcast")) continue;

        try {
          const pLid = msg.key.participant?.endsWith("@lid")
            ? msg.key.participant
            : msg.key.remoteJid?.endsWith("@lid")
              ? msg.key.remoteJid
              : null;
          const pPn = [msg.key.participantPn, msg.key.participantAlt, msg.key.remoteJidAlt, msg.key.senderPn].find(
            (x) => typeof x === "string" && x.endsWith("@s.whatsapp.net")
          );
          if (pLid && pPn) {
            db.rememberLidPn(pLid, pPn);
          }
        } catch (_) { }

        if (msg.message?.deviceSentMessage?.message) {
          msg.message = msg.message.deviceSentMessage.message;
        }

        const rawMsg = msg.message;
        if (rawMsg) {
          if (
            rawMsg.protocolMessage ||
            rawMsg.reactionMessage ||
            rawMsg.pollUpdateMessage ||
            rawMsg.senderKeyDistributionMessage
          ) {
            continue;
          }
        }

        const stubType = Number(msg.messageStubType) || 0;
        const stubStr = String(msg.messageStubType || "").toLowerCase();
        const isDecryptionFailure = stubType === 2 || stubStr === "ciphertext";

        const preview =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          (msg.message ? `[${Object.keys(msg.message)[0]}]` : isDecryptionFailure ? "[CIPHERTEXT]" : "");
        if (preview && !preview.startsWith("[protocolMessage]") && !preview.startsWith("[reactionMessage]")) {
          logger.info(`[Msg In] ${rjid} (fromMe=${Boolean(msg.key.fromMe)}): ${String(preview).slice(0, 60)}`);
        }

        try {
          const autoRead = Boolean(db.getSettings?.()?.autoRead);
          if (autoRead && !msg.key.fromMe) {
            sock.readMessages([msg.key]).catch(() => { });
          }
        } catch (_) { }

        if (isDecryptionFailure) {
          const senderJid = msg.key.participant || msg.key.remoteJid;
          const decryptErr =
            Array.isArray(msg.messageStubParameters) && msg.messageStubParameters.length > 0
              ? String(msg.messageStubParameters[0] || "")
              : "Decryption failure (Ciphertext)";

          const failureCount = recordDecryptionFailure(senderJid, decryptErr);
          if (failureCount) {
            logger.warn(
              `[Session] Gagal dekripsi dari ${senderJid} (${failureCount}/${SESSION_FAILURE_THRESHOLD}): ${decryptErr}`
            );
            await resetSessionIfThresholdReached(senderJid, sock, failureCount);
            continue;
          }
        }

        if (!msg.message && !isDecryptionFailure) {
          continue;
        }

        enqueueMessage(sock, msg, logger);
      } catch (err) {
        logger?.error?.(`[Message Handler Error] ${err?.stack || err?.message || err}`);
      }
    }
  });
}
