import { Boom } from "@hapi/boom";
import { DisconnectReason } from "ourin-baileys";
import qrcode from "qrcode-terminal";
import { db } from "@/src/core/database.js";
import { enqueueMessage } from "@/src/core/queue.js";
import { attachEchoTracker } from "@/src/core/dispatch/echo.js";
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
      const wasRegistered = Boolean(sock.authState?.creds?.registered);

      try {
        const { setPrimaryOnline, notifyOwner } = await import("@/src/services/system/health.js");
        setPrimaryOnline(false);

        if (!shouldReconnect && wasRegistered) {
          notifyOwner("Peringatan: primary bot logout, perlu pairing ulang.").catch(() => {});
        }
      } catch (_) {}

      // Jika socket terputus saat belum terdaftar (misal user belum selesai memasukkan kode), PERTAHANKAN sesi!
      // JANGAN hapus authDir agar kredensial pairing code di HP tidak menjadi tidak valid!
      if (!wasRegistered) {
        connectionState.unregisteredFailures = (connectionState.unregisteredFailures || 0) + 1;

        const waitMs = 3000;
        logger.info(`Mempertahankan sesi pairing. Menghubungkan kembali soket dalam ${waitMs / 1000} detik...`);
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
        logger.info("Mencoba menghubungkan kembali (reconnect) dalam 5 detik...");
        if (connectionState.reconnectTimer) clearTimeout(connectionState.reconnectTimer);
        connectionState.reconnectTimer = setTimeout(() => {
          connectionState.reconnectTimer = null;
          restart().catch((err) => {
            logger.error("Gagal restart bot:", err);
          });
        }, 5000);
        return;
      }

      // Kasus logout resmi dari WhatsApp Web
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
      if (timers.pairingTimeout) clearTimeout(timers.pairingTimeout);
      logger.info("🎉 Primary Rizzer Bot BERHASIL TERHUBUNG dan sekarang ONLINE!");
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
  attachEchoTracker(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.key || !msg.key.remoteJid || !msg.key.id) continue;
        const rjid = msg.key.remoteJid;
        if (rjid === "status@broadcast") {
          try {
            const { handleStatusBroadcast } = await import("@/src/middleware/statusSaver.js");
            handleStatusBroadcast(sock, msg, logger).catch(() => {});
          } catch (_) {}
          continue;
        }
        if (rjid.endsWith("@newsletter") || rjid.endsWith("@broadcast")) continue;
        if (msg.message) {
          const keys = Object.keys(msg.message);
          if (
            keys.length === 1 &&
            (keys[0] === "protocolMessage" || keys[0] === "reactionMessage" || keys[0] === "pollUpdateMessage")
          )
            continue;
        }

        enqueueMessage(sock, msg, logger);
      } catch (err) {
        logger?.error?.("[Message Handler Error]", err?.message || err);
      }
    }
  });
}
