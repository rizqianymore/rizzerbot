import { db } from "@/src/core/database.js";
import { isGroupJid } from "./identity.js";
import { trackCrashSender } from "./guards.js";
import { extractButtonText } from "@/src/utils/buttons.js";

const ONE_CHAR_FLOOD_RE = /^(.)\1{2500,}$/s;
const FLOOD_RE = /\\u0000(\\u0000){20,}|ꦾ{5000,}|𑇂{1000,}/;
const SPACE_RE = /\s/g;

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

    if (messageContent.length >= LIMIT.repeatChar && ONE_CHAR_FLOOD_RE.test(messageContent.replace(SPACE_RE, ""))) {
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

    const tapText = extractButtonText(m);

    const unparsedButtonTap = Boolean(m.interactiveResponseMessage) && !tapText;
    if (unparsedButtonTap) {
      logger?.warn?.(`[Anti-Crash] Balasan tombol tanpa id terbaca, diteruskan sebagai teks biasa`);
    }

    const crashKey =
      m.groupStatusMessageV2 ||
      m.viewOnceMessage?.message?.buttonsMessage ||
      m.viewOnceMessage?.message?.interactiveMessage;

    const vcard = m.contactMessage?.vcard || "";
    const vcardLen = typeof vcard === "string" ? vcard.length : 0;
    const extLen = m.extendedTextMessage?.text?.length || 0;
    const btns = m.interactiveMessage?.nativeFlowMessage?.buttons;
    const btnCount = Array.isArray(btns) ? btns.length : 0;
    const pollOpts = m.pollCreationMessage?.options;
    const pollCount = Array.isArray(pollOpts) ? pollOpts.length : 0;
    const docCapLen = m.documentMessage?.caption?.length || 0;
    const listSections = m.listMessage?.sections;
    const listCount = Array.isArray(listSections) ? listSections.reduce((a, s) => a + (Array.isArray(s.rows) ? s.rows.length : 0), 0) : 0;
    const tapPayloadTooBig = unparsedButtonTap && rawStr.length > LIMIT.rawScan;
    const flood = rawStr.length > LIMIT.rawScan && FLOOD_RE.test(rawStr);
    if (
      crashKey ||
      flood ||
      tapPayloadTooBig ||
      vcardLen > LIMIT.vcard ||
      extLen > LIMIT.extText ||
      btnCount > LIMIT.buttons ||
      pollCount > 100 ||
      docCapLen > 10000 ||
      listCount > 200
    ) {
      logger?.warn?.(
        `[Anti-Crash L4] crashKey=${Boolean(crashKey)} flood=${flood} tap=${tapPayloadTooBig} vcard=${vcardLen} ext=${extLen} btn=${btnCount} poll=${pollCount} docCap=${docCapLen} list=${listCount}`
      );
      await dropInGroup();
      trackCrashSender(msg.key.participant || remoteJid);
      return true;
    }
  }
  return false;
}
