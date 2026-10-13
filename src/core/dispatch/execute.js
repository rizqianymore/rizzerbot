import { db } from "@/src/core/database.js";
import { isGroupJid } from "./identity.js";
import { getUniversalContextInfo, findPhoneJid } from "./message.js";
import { getGroupAccessError } from "./group.js";

export async function executeCommand(sock, msg, logger, env) {
  const {
    remoteJid,
    senderJid,
    cmd,
    access,
    activeSettings,
    prefix,
    args,
    commandName,
    isOwner,
    isAdmin,
    isPremium,
    user,
    botJid,
    isSubBotSock,
  } = env;

  const groupAccessError = await getGroupAccessError(sock, remoteJid, senderJid, cmd, access);
  if (groupAccessError) {
    if (activeSettings.silentDeny !== false) return;
    return sock.sendMessage(remoteJid, { text: groupAccessError }, { quoted: msg });
  }

  logger?.info?.(
    `[Command] ${cmd.name} from ${msg.pushName || "User"} (${senderJid}) via ${isSubBotSock ? "sub" : "main"} (${botJid})`
  );
  db.recordCommand(cmd.name);

  const responseDelay = Number(activeSettings.responseDelay) || 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isPrimarySuperOwner = db.isPrimaryOwner(senderJid);

  const isSub = Boolean(sock.isSubBot);

  const context = {
    logger,
    botJid,
    isSubBot: isSub,
    isPrimarySuperOwner,
    activeSettings,
    prefix,
    activePrefix: prefix,
    commandName,
    isOwner,
    isAdmin,
    isPremium,
    access: {
      ...access,
      owner: isOwner,
      admin: isAdmin,
      premium: isPremium,
      role: isOwner ? "owner" : isAdmin ? "admin" : isPremium ? "premium" : access.role || "user",
    },
    senderJid,
    isGroup: isGroupJid(remoteJid),
    user,
    msg,
    quoted: getUniversalContextInfo(msg.message)?.quotedMessage || null,
    sendTyping: async () => {
      Promise.resolve(sock.sendPresenceUpdate?.("composing", remoteJid)).catch(() => {});
    },
    reply: async (text) => {
      if (responseDelay > 0) {
        Promise.resolve(sock.sendPresenceUpdate?.("composing", remoteJid)).catch(() => {});
        await delay(responseDelay);
      }
      return sock.sendMessage(remoteJid, { text }, { quoted: msg });
    },
    getTargetJid: (targetArgs) => {
      const _ctx = getUniversalContextInfo(msg.message) || {};
      const quotedJid = _ctx.participant || _ctx.remoteJid;
      if (quotedJid && !String(quotedJid).endsWith("@g.us")) {
        const resolved = db.resolvePhoneJid(quotedJid);
        if (resolved.endsWith("@s.whatsapp.net")) return resolved;
      }

      const mentioned = _ctx.mentionedJid;
      const mentionedList = Array.isArray(mentioned) ? mentioned : mentioned ? [mentioned] : [];
      for (const candidate of mentionedList) {
        const resolved = db.resolvePhoneJid(candidate);
        if (resolved.endsWith("@s.whatsapp.net")) return resolved;
      }

      return findPhoneJid(targetArgs);
    },
  };

  try {
    await cmd.run(sock, msg, args, context);
  } catch (err) {
    logger?.error?.(`[Command Error] ${cmd.name}:`, err);
    context.reply(`❌ Error: ${err.message}`);
  }
}
