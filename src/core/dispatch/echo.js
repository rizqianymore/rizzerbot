const ID_TTL_MS = 5 * 60 * 1000;
const TEXT_TTL_MS = 20 * 1000;
const MAX_IDS = 2000;
const MAX_TEXTS = 500;

const sentIds = new Map();
const sentTexts = new Map();

function normalizeText(text) {
  const value = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!value) return "";
  return value.length > 800 ? value.slice(0, 800) : value;
}

function prune(now) {
  if (sentIds.size > MAX_IDS) {
    for (const [key, at] of sentIds.entries()) {
      if (now - at > ID_TTL_MS) sentIds.delete(key);
    }
  }
  if (sentTexts.size > MAX_TEXTS) {
    for (const [key, at] of sentTexts.entries()) {
      if (now - at > TEXT_TTL_MS) sentTexts.delete(key);
    }
  }
}

export function rememberSentMessage(id, text) {
  const now = Date.now();
  if (id) {
    sentIds.set(String(id), now);
  }
  const normalized = normalizeText(text);
  if (normalized) {
    sentTexts.set(normalized, now);
  }
  prune(now);
}

export function isBotEchoMessage({ id, text } = {}) {
  const now = Date.now();

  if (id && sentIds.has(String(id))) return true;

  const normalized = normalizeText(text);
  if (!normalized) return false;
  const at = sentTexts.get(normalized);
  if (at && now - at < TEXT_TTL_MS) return true;

  return false;
}

export function extractOutgoingText(content) {
  if (!content || typeof content !== "object") return "";
  if (typeof content === "string") return content;

  if (typeof content.text === "string") return content.text;
  if (typeof content.caption === "string") return content.caption;
  if (typeof content.conversation === "string") return content.conversation;
  if (typeof content.extendedTextMessage?.text === "string") return content.extendedTextMessage.text;
  if (typeof content.buttonsMessage?.contentText === "string") return content.buttonsMessage.contentText;
  if (typeof content.templateMessage?.hydratedTemplate?.hydratedContentText === "string") {
    return content.templateMessage.hydratedTemplate.hydratedContentText;
  }
  if (typeof content.interactiveMessage?.title === "string") return content.interactiveMessage.title;
  if (typeof content.interactiveMessage?.body?.text === "string") return content.interactiveMessage.body.text;
  return "";
}

export function clearSentMessageCache() {
  sentIds.clear();
  sentTexts.clear();
}

export function attachEchoTracker(sock) {
  if (!sock || sock.__echoTrackerAttached) return sock;

  const original = sock.sendMessage;
  if (typeof original !== "function") return sock;

  sock.sendMessage = async function trackedSendMessage(jid, content, options) {
    const result = await original.call(this, jid, content, options);
    try {
      rememberSentMessage(result?.key?.id, extractOutgoingText(content));
    } catch (_) {}
    return result;
  };

  sock.__echoTrackerAttached = true;
  return sock;
}
