import { db } from "@/src/core/database.js";

export function looksLikeExternalBot(msg, text) {
  const name = String(msg?.pushName || "").toLowerCase();
  if (!name) return false;
  if (!/bot|assistant|official|support|ai\b/.test(name)) return false;

  if (text && text.length > 200 && /(?:✅|❌|⚠️|📊|👑)/u.test(text)) return true;
  return /\bbot\b/.test(name);
}

const DEDUP_TTL_MS = 5 * 60 * 1000;
const MAX_DEDUP_SIZE = 4000;
const seenMessageIds = new Map();

// Pembersihan berkala otomatis agar tidak memakan CPU saat lookup
let _dedupCleanupTimer = null;
function ensureDedupCleanup() {
  if (_dedupCleanupTimer) return;
  _dedupCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, t] of seenMessageIds.entries()) {
      if (now - t > DEDUP_TTL_MS) seenMessageIds.delete(k);
    }
  }, 60 * 1000);
  if (_dedupCleanupTimer.unref) _dedupCleanupTimer.unref();
}
ensureDedupCleanup();

export function isDuplicateMessage(botIdentity, key) {
  const id = key?.id;
  if (!id) return false;
  const mapKey = `${botIdentity}::${id}`;
  const now = Date.now();
  const last = seenMessageIds.get(mapKey);
  if (last !== undefined && now - last < DEDUP_TTL_MS) return true;

  if (seenMessageIds.size >= MAX_DEDUP_SIZE) {
    const oldestKey = seenMessageIds.keys().next().value;
    if (oldestKey) seenMessageIds.delete(oldestKey);
  }

  seenMessageIds.set(mapKey, now);
  return false;
}

export function unwrapMessageContent(message) {
  if (!message || typeof message !== "object") return message;
  let current = message;
  for (let i = 0; i < 6; i++) {
    if (current.deviceSentMessage?.message) {
      current = current.deviceSentMessage.message;
    } else if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
    } else if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage?.message?.protocolMessage?.editedMessage) {
      current = current.editedMessage.message.protocolMessage.editedMessage;
    } else {
      break;
    }
  }
  return current;
}

export function getUniversalContextInfo(message) {
  if (!message || typeof message !== "object") return null;
  const candidates = [
    message.conversation,
    message.extendedTextMessage,
    message.imageMessage,
    message.videoMessage,
    message.documentMessage,
    message.documentWithCaptionMessage?.message?.documentMessage,
    message.stickerMessage,
    message.audioMessage,
    message.buttonsResponseMessage,
    message.listResponseMessage,
    message.templateButtonReplyMessage,
    message.interactiveResponseMessage,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && c.contextInfo) return c.contextInfo;
  }

  for (const v of Object.values(message)) {
    if (v && typeof v === "object" && v.contextInfo) return v.contextInfo;
  }
  return null;
}

export function getPhoneDigitsFn(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isPhoneJid(jid, minimumDigits = 10) {
  return Boolean(jid && jid.endsWith("@s.whatsapp.net") && getPhoneDigitsFn(jid).length >= minimumDigits);
}

export function findPhoneJid(values) {
  const parts = (
    Array.isArray(values)
      ? values
      : String(values || "")
          .trim()
          .split(/[\s,;]+/)
  )
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (let start = 0; start < parts.length; start += 1) {
    const directValue = parts[start];
    if (directValue.includes("@") || directValue.startsWith("+")) {
      const directJid = db.resolvePhoneJid(directValue);
      const explicitJid = directValue.includes("@") && directValue.indexOf("@", 1) >= 0;
      if (
        directJid &&
        !directJid.endsWith("@g.us") &&
        directJid.endsWith("@s.whatsapp.net") &&
        (explicitJid || isPhoneJid(directJid))
      )
        return directJid;
    }

    let candidate = "";
    for (let end = start; end < Math.min(parts.length, start + 4); end += 1) {
      candidate = candidate ? `${candidate} ${parts[end]}` : parts[end];
      const jid = db.normalizeJid(candidate);
      if (isPhoneJid(jid)) return jid;
    }
  }

  return null;
}
