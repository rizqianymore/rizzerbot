import { db } from "@/src/core/database.js";
import { isSameBotJid } from "./identity.js";
import { getUniversalContextInfo } from "./message.js";
import { resolveGroupResponder } from "./group.js";

export async function routeMultiBot(sock, msg, { remoteJid, botJid, isSubBotSock, commandName, senderJid }) {
  const uniCtx = getUniversalContextInfo(msg.message) || {};

  const mentionedJids = (uniCtx.mentionedJid || []).map((j) => db.resolvePhoneJid(j)).filter(Boolean);
  const quotedParticipant = db.resolvePhoneJid(uniCtx.participant || "");

  const anyBotMentioned = mentionedJids.some((j) => db.isAnyBotJid(j));
  const quotedIsBot = Boolean(quotedParticipant) && db.isAnyBotJid(quotedParticipant);
  const isTaggedHere = mentionedJids.some((j) => isSameBotJid(j, botJid));
  const isQuotedHere = Boolean(quotedParticipant && isSameBotJid(quotedParticipant, botJid));

  if (anyBotMentioned && !isTaggedHere) {
    return true;
  }

  if (quotedIsBot && !isQuotedHere) {
    return true;
  }

  if (!anyBotMentioned && !quotedIsBot) {
    const ownerCommands = ["self", "public", "pub", "setprefix", "delbot", "syncsubbot", "vps"];

    if (ownerCommands.includes(commandName)) {
      if (isSubBotSock) {
        return true;
      }
      if (!isSubBotSock) {
        const isMainOwner = db.isPrimaryOwner(senderJid);
        if (!isMainOwner) {
          return true;
        }
      }
    } else {
      const verdict = await resolveGroupResponder(sock, remoteJid, botJid, isSubBotSock);
      if (verdict.mode === "multi-main-present" || verdict.mode === "multi-sub-only") {
        if (!verdict.shouldRespond) return true;
      } else if (verdict.mode === "unknown") {
        if (isSubBotSock) {
          return true;
        }
      }
    }
  }
  return false;
}
