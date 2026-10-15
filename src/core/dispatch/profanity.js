import { checkProfanity } from "@/src/utils/filter.js";
import { getUniversalContextInfo } from "./message.js";

export async function checkProfanityInput(sock, msg, logger, { remoteJid, senderJid, args }) {
  const uniCtxQ = getUniversalContextInfo(msg.message) || {};
  const quotedMsgQ = uniCtxQ.quotedMessage || {};
  const quotedText =
    quotedMsgQ.conversation ||
    quotedMsgQ.extendedTextMessage?.text ||
    quotedMsgQ.imageMessage?.caption ||
    quotedMsgQ.videoMessage?.caption ||
    quotedMsgQ.documentMessage?.caption ||
    "";
  const textToCheck = `${args.join(" ")} ${quotedText}`.trim();
  const check = checkProfanity(textToCheck);

  if (check.isViolation) {
    logger?.warn?.(
      `[Blocked-Input] User ${senderJid} (${msg.pushName}) mencoba konten terlarang 18+ ("${check.matchedWord}")`
    );
    await sock.sendMessage(
      remoteJid,
      {
        text:
          `⚠️ *Peringatan Konten*\n\n` +
          `Pesan mengandung kata atau permintaan konten terlarang (*"${check.matchedWord}"*).\n` +
          `Permintaan dibatalkan.`,
      },
      { quoted: msg }
    );
    return true;
  }
  return false;
}
