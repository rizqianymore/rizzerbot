import { db } from "@/src/core/database.js";
import { isGroupJid } from "./identity.js";
import { trackCrashSender } from "./guards.js";

export async function checkAntiCrash(sock, msg, logger, remoteJid, messageContent) {
  const _s = db.getSettings();
  if (_s.antiVirtex !== false) {
    const LIMIT = {
      text: Number(_s.maxMessageLength) || 5000,
      repeatChar: 2500,
      rawBytes: 150000,
      rawScan: 20000,
      vcard: 5000,
      extText: 20000,
      buttons: 50,
    };
    const dropInGroup = async () => {
      if (!isGroupJid(remoteJid)) return;
      try {
        await sock.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
      } catch (_) {}
    };

    if (messageContent.length > LIMIT.text) {
      logger?.warn?.(`[Anti-Crash L1] Teks ${messageContent.length} char > ${LIMIT.text}`);
      await dropInGroup();
      return true;
    }

    if (/^(.)\1{2500,}$/s.test(messageContent.replace(/\s/g, ""))) {
      logger?.warn?.(`[Anti-Crash L2] Pola 1-char flood`);
      await dropInGroup();
      return true;
    }

    let rawStr = "";
    try {
      rawStr = JSON.stringify(msg.message) || "";
    } catch (_) {}
    if (rawStr.length > LIMIT.rawBytes) {
      logger?.warn?.(`[Anti-Crash L3] Payload ${rawStr.length} byte`);
      await dropInGroup();
      trackCrashSender(msg.key.participant || remoteJid);
      return true;
    }

    const m = msg.message || {};
    const crashKey =
      m.groupStatusMessageV2 ||
      m.interactiveResponseMessage ||
      m.viewOnceMessage?.message?.buttonsMessage ||
      m.viewOnceMessage?.message?.interactiveMessage;

    const vcard = m.contactMessage?.vcard || "";
    const vcardLen = typeof vcard === "string" ? vcard.length : 0;
    const extLen = m.extendedTextMessage?.text?.length || 0;
    const btns = m.interactiveMessage?.nativeFlowMessage?.buttons;
    const btnCount = Array.isArray(btns) ? btns.length : 0;
    const flood = rawStr.length > LIMIT.rawScan && /\\u0000(\\u0000){20,}|ꦾ{5000,}|𑇂{1000,}/.test(rawStr);
    if (crashKey || flood || vcardLen > LIMIT.vcard || extLen > LIMIT.extText || btnCount > LIMIT.buttons) {
      logger?.warn?.(
        `[Anti-Crash L4] crashKey=${Boolean(crashKey)} flood=${flood} vcard=${vcardLen} ext=${extLen} btn=${btnCount}`
      );
      await dropInGroup();
      trackCrashSender(msg.key.participant || remoteJid);
      return true;
    }
  }
  return false;
}
