import { downloadMediaMessage, extractMessageContent } from "baileys";
import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";

// Cache in-memory untuk menyimpan View Once terbaru
// Key: remoteJid:stanzaId atau remoteJid
const MAX_VAULT_SIZE = 100;
const _viewOnceVault = new Map();

function getMediaNode(m) {
  if (!m) return null;
  const content = extractMessageContent(m);
  if (!content) return null;
  const keys = Object.keys(content);

  const hasMedia =
    keys.includes("imageMessage") ||
    keys.includes("videoMessage") ||
    keys.includes("audioMessage");

  if (hasMedia) return content;

  if (keys.includes("viewOnceMessage"))
    return getMediaNode(content.viewOnceMessage.message);
  if (keys.includes("viewOnceMessageV2"))
    return getMediaNode(content.viewOnceMessageV2.message);
  if (keys.includes("viewOnceMessageV2Extension"))
    return getMediaNode(content.viewOnceMessageV2Extension.message);

  return null;
}

export async function interceptViewOnce(sock, rawMsg, logger) {
  if (!rawMsg.message || rawMsg.key?.fromMe) return;

  const rawKeys = Object.keys(rawMsg.message);
  const isVO =
    rawKeys.includes("viewOnceMessage") ||
    rawKeys.includes("viewOnceMessageV2") ||
    rawKeys.includes("viewOnceMessageV2Extension") ||
    rawMsg.message?.imageMessage?.viewOnce ||
    rawMsg.message?.videoMessage?.viewOnce ||
    rawMsg.message?.audioMessage?.viewOnce;

  if (!isVO) return;

  const mediaNode = getMediaNode(rawMsg.message);
  if (!mediaNode) return;

  const remoteJid = rawMsg.key.remoteJid;
  const participant = rawMsg.key.participant || remoteJid;
  const senderNum = participant.split("@")[0];
  const stanzaId = rawMsg.key.id;

  try {
    const buffer = await downloadMediaMessage(
      {
        key: rawMsg.key,
        message: mediaNode,
      },
      "buffer",
      {},
      {
        logger: {
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
          }),
        },
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    if (!buffer || buffer.length === 0) return;

    let mediaType = "image";
    let mimetype = "image/jpeg";
    let caption = "";

    if (mediaNode.imageMessage) {
      mediaType = "image";
      mimetype = mediaNode.imageMessage.mimetype || "image/jpeg";
      caption = mediaNode.imageMessage.caption || "";
    } else if (mediaNode.videoMessage) {
      mediaType = "video";
      mimetype = mediaNode.videoMessage.mimetype || "video/mp4";
      caption = mediaNode.videoMessage.caption || "";
    } else if (mediaNode.audioMessage) {
      mediaType = "audio";
      mimetype = mediaNode.audioMessage.mimetype || "audio/mp4";
    }

    const item = {
      id: stanzaId,
      remoteJid,
      participant,
      senderNum,
      mediaType,
      mimetype,
      caption,
      buffer,
      timestamp: Date.now(),
    };

    // Simpan ke vault dengan batas ukuran
    if (_viewOnceVault.size >= MAX_VAULT_SIZE) {
      const oldestKey = _viewOnceVault.keys().next().value;
      _viewOnceVault.delete(oldestKey);
    }
    _viewOnceVault.set(stanzaId, item);
    _viewOnceVault.set(`${remoteJid}:latest`, item);

    if (logger) {
      logger.info(`[ViewOnce Vault] Intercepted 1 ${mediaType} from ${senderNum} in ${remoteJid}`);
    }

    // Auto-forward ke watchdog/owner jika diaktifkan di settings / database
    if (db.data?.settings?.autoForwardVO) {
      const targetOwner = db.normalizeJid(settings.ownerNumber);
      if (targetOwner && remoteJid !== targetOwner) {
        const infoText =
          `👁️ *[VIEW-ONCE INTERCEPTED]*\n\n` +
          `• Pengirim: @${senderNum}\n` +
          `• Sumber Chat: ${remoteJid.endsWith("@g.us") ? "Grup" : "Private"}\n` +
          `• Waktu: ${new Date().toLocaleTimeString("id-ID")}` +
          (caption ? `\n• Caption: ${caption}` : "");

        if (mediaType === "image") {
          await sock.sendMessage(targetOwner, { image: buffer, caption: infoText, mentions: [participant] }).catch(() => {});
        } else if (mediaType === "video") {
          await sock.sendMessage(targetOwner, { video: buffer, caption: infoText, mentions: [participant] }).catch(() => {});
        } else if (mediaType === "audio") {
          await sock.sendMessage(targetOwner, { audio: buffer, mimetype, ptt: true }).catch(() => {});
        }
      }
    }
  } catch (err) {
    if (logger) {
      logger.debug(`[ViewOnce Vault] Failed to intercept: ${err.message}`);
    }
  }
}

export function getViewOnceFromVault(stanzaIdOrJid) {
  if (_viewOnceVault.has(stanzaIdOrJid)) {
    return _viewOnceVault.get(stanzaIdOrJid);
  }
  const latestKey = `${stanzaIdOrJid}:latest`;
  if (_viewOnceVault.has(latestKey)) {
    return _viewOnceVault.get(latestKey);
  }
  return null;
}
