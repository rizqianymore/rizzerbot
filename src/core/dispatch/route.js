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
      // FIX: owner bot-nya sendiri selalu dapat prioritas, jangan kalah winner-election
      // case user: bot gue self tapi sticker gue ga keluar, malah kekirim bot temen
      if (db.isBotOwner(botJid, senderJid) || db.isOwner(senderJid)) {
        return false;
      }

      // FIX: kalau bot ini sedang self/private dan sender bukan owner, ngalah ke bot lain
      // biar ga spam "private" dobel dan biar bot temen yang public yang handle non-owner
      try {
        const mySettings = db.getBotSettings(botJid);
        if (mySettings?.public === false) {
          // sender sudah pasti bukan owner (dicek diatas), jadi yield
          const verdictSelf = await resolveGroupResponder(sock, remoteJid, botJid, isSubBotSock, senderJid);
          // tetap yield, return true biar ditahan
          if (verdictSelf.mode !== "solo") return true;
          // solo tapi self -> tetap tahan agar tidak spam, biar bot temen yang jawab
          return true;
        }
      } catch (_) {}

      const verdict = await resolveGroupResponder(sock, remoteJid, botJid, isSubBotSock, senderJid);
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
