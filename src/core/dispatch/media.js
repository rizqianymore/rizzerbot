import { mediaHandlers } from "@/src/core/loader.js";
import { resolveSenderJid } from "./identity.js";

/**
 * Jalankan handler media (foto) yang didaftarkan plugin.
 *
 * Dipakai untuk aksi otomatis tanpa perintah, contoh: siswa mengirim foto
 * QR guru -> bot scan -> kirim presensi.
 *
 * @returns {Promise<boolean>} true bila ada handler yang menangani pesan.
 */
export async function runMediaHandlers(sock, msg, logger) {
  if (!mediaHandlers.size) return false;

  const message = msg?.message || {};
  const hasMedia = Boolean(
    message.imageMessage || message.documentMessage || message.videoMessage || message.locationMessage
  );
  if (!hasMedia) return false;

  const senderJid = resolveSenderJid(msg);
  const remoteJid = msg?.key?.remoteJid || "";

  for (const [name, handler] of mediaHandlers.entries()) {
    try {
      const handled = await handler(sock, msg, { logger, senderJid, remoteJid });
      if (handled) return true;
    } catch (err) {
      logger?.warn?.(`[MediaHandler] ${name} gagal: ${String(err?.message || err).slice(0, 120)}`);
    }
  }
  return false;
}
