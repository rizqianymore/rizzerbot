import { extractMessageContent } from "ourin-baileys";
import { extractButtonText } from "@/src/utils/buttons.js";
import { db } from "@/src/core/database.js";
import { isGroupJid, resolveSenderJid, resolveBotJid, resolveBotIdentity } from "./identity.js";
import { isCrashBlocked } from "./guards.js";
import { isDuplicateMessage } from "./message.js";
import { checkAntiCrash } from "./antivirus.js";
import { checkAntilink } from "./antilink.js";
import { checkAntiBot } from "./antibot.js";
import { resolveCommandAccess } from "./access.js";
import { routeMultiBot } from "./route.js";
import { checkProfanityInput } from "./profanity.js";
import { checkPermits, checkRateLimit } from "./limits.js";
import { executeCommand } from "./execute.js";

export async function dispatchMessage(sock, msg, logger) {
  return db.runWithBot(resolveBotJid(sock), () => dispatchInner(sock, msg, logger));
}

async function dispatchInner(sock, msg, logger) {
  if (!msg.message || !msg.key?.id) return;

  const botJidEarly = resolveBotJid(sock);
  const botIdentity = resolveBotIdentity(sock);
  if (isDuplicateMessage(botIdentity, msg.key)) return;

  const rawTypeKeys = msg.message ? Object.keys(msg.message) : [];
  if (
    rawTypeKeys.length === 1 &&
    (rawTypeKeys[0] === "protocolMessage" ||
      rawTypeKeys[0] === "reactionMessage" ||
      rawTypeKeys[0] === "pollUpdateMessage")
  ) {
    return;
  }

  msg.message = extractMessageContent(msg.message);
  if (!msg.message) return;

  if (msg.message.protocolMessage || msg.message.reactionMessage) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast") return;
  if (isCrashBlocked(msg.key.participant || remoteJid)) return;

  if (remoteJid.endsWith("@newsletter") || remoteJid.endsWith("@broadcast")) return;

  try {
    const ts = Number(msg.messageTimestamp);
    if (Number.isFinite(ts) && ts > 0) {
      const ageMs = Date.now() - ts * 1000;
      if (ageMs > 2 * 60 * 1000) return;

      if (ageMs < -5 * 60 * 1000) return;
    }
  } catch (_) {}

  const messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    extractButtonText(msg.message) ||
    "";

  if (await checkAntiCrash(sock, msg, logger, remoteJid, messageContent)) return;

  if (await checkAntilink(sock, msg, logger, remoteJid, messageContent)) return;

  const isFromMe = Boolean(msg.key?.fromMe);
  const botJid = botJidEarly || db.normalizeJid(sock.user?.id || "");

  const normalizedRawSender = resolveSenderJid(msg);
  const remoteNormalized = db.resolvePhoneJid(remoteJid);

  if (botJid) {
    db.registerBotJid(botJid);
  }

  if (!isFromMe && db.isAnyBotJid(normalizedRawSender)) {
    return;
  }

  if (checkAntiBot(sock, msg, logger, { isFromMe, normalizedRawSender, messageContent })) return;

  const resolved = await resolveCommandAccess(sock, msg, {
    botJidEarly,
    botJid,
    isFromMe,
    normalizedRawSender,
    remoteNormalized,
    messageContent,
  });
  if (resolved.drop) return;
  const { activeSettings, prefix, args, commandName, cmd, senderJid } = resolved;
  const { isOwner, isAdmin, isPremium } = resolved;
  let { access, user } = resolved;

  const isGroup = isGroupJid(remoteJid);

  const isSubBotSock = sock.isSubBot === true;
  if (isGroup && !isFromMe) {
    if (await routeMultiBot(sock, msg, { remoteJid, botJid, isSubBotSock, commandName, senderJid })) return;
  }

  if (isOwner && access.user && (!access.user.owner || !access.user.premium)) {
    logger?.warn?.(
      `[PrivEsc-Guard] ${senderJid} lolos cek owner via config/tugas tapi record DB belum owner. ` +
        `Akses ephemeral untuk perintah ini saja, TANPA tulis database.`
    );
  }

  if (access.user && msg.pushName && access.user.name !== msg.pushName) {
    user = db.updateUser(senderJid, { name: msg.pushName });
    access = db.getAccess(senderJid);
  } else if (access.user) {
    user = access.user;
  }

  if (user.banned && !isOwner) return;

  if (!isOwner) {
    if (await checkProfanityInput(sock, msg, logger, { remoteJid, senderJid, args })) return;
  }

  const deny = async (text) => {
    if (activeSettings.silentDeny !== false) return;
    await sock.sendMessage(remoteJid, { text }, { quoted: msg });
  };

  if (await checkPermits(cmd, { isOwner, isAdmin, isPremium }, deny)) return;

  if (!isOwner) {
    if (await checkRateLimit(activeSettings, senderJid, sock, msg, remoteJid)) return;
  }

  await executeCommand(sock, msg, logger, {
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
  });
}
