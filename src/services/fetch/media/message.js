import { extractMessageContent } from "baileys";

const MEDIA_TYPES = [
  "imageMessage",
  "videoMessage",
  "stickerMessage",
  "documentMessage",
  "audioMessage",
  "ptvMessage",
];

export function unwrapMessageContent(content) {
  try {
    if (!content) return content;
    let curr = content;
    for (let i = 0; i < 5; i++) {
      if (curr.viewOnceMessage?.message) curr = curr.viewOnceMessage.message;
      else if (curr.viewOnceMessageV2?.message) curr = curr.viewOnceMessageV2.message;
      else if (curr.viewOnceMessageV2Extension?.message) curr = curr.viewOnceMessageV2Extension.message;
      else if (curr.ephemeralMessage?.message) curr = curr.ephemeralMessage.message;
      else if (curr.documentWithCaptionMessage?.message) curr = curr.documentWithCaptionMessage.message;

      const extracted = extractMessageContent(curr);
      if (!extracted || extracted === curr) break;
      curr = extracted;
    }
    return curr || content;
  } catch (_) {
    return content;
  }
}

export function getQuotedMessage(msg) {
  const rawMsg = msg?.message || {};
  let ctxInfo = null;

  for (const val of Object.values(rawMsg)) {
    if (val && typeof val === "object" && val.contextInfo) {
      ctxInfo = val.contextInfo;
      break;
    }
  }

  const quotedMsg = ctxInfo?.quotedMessage ? unwrapMessageContent(ctxInfo.quotedMessage) : null;
  return { ctxInfo, quotedMsg, stanzaId: ctxInfo?.stanzaId, participant: ctxInfo?.participant };
}

export function findDownloadableTarget(msg) {
  if (!msg?.message) return null;
  const unwrapped = unwrapMessageContent(msg.message) || {};
  const directType = Object.keys(unwrapped).find((k) => MEDIA_TYPES.includes(k));
  if (directType) {
    return { ...msg, message: unwrapped };
  }

  const { quotedMsg, stanzaId, participant } = getQuotedMessage(msg);
  if (quotedMsg) {
    const quotedType = Object.keys(quotedMsg).find((k) => MEDIA_TYPES.includes(k));
    if (quotedType) {
      return {
        key: {
          ...msg.key,
          ...(stanzaId ? { id: stanzaId } : {}),
          ...(participant ? { participant } : {}),
        },
        message: quotedMsg,
      };
    }
  }
  return null;
}
