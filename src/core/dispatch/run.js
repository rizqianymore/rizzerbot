import { extractMessageContent } from "baileys";
import { extractButtonText } from "@/src/utils/buttons.js";
import { db } from "@/src/core/database.js";
import { isGroupJid, resolveSenderJid, resolveBotJid, resolveBotIdentity } from "./identity.js";
import { isCrashBlocked, registerOwnerCommand } from "./guards.js";
import { isDuplicateMessage, unwrapMessageContent } from "./message.js";

let _staleCount = 0;
let _lastStaleLog = 0;

const PROCESS_START_TIME_SEC = Math.floor(Date.now() / 1000);

function logStaleThrottled(logger, ageSec, msgId) {
  _staleCount++;
  const now = Date.now();
  if (now - _lastStaleLog > 3000) {
    if (_staleCount === 1) {
      logger?.info?.(`[Stale] pesan lama dilewati (umur ${ageSec}s): ${msgId}`);
    } else {
      logger?.info?.(`[Stale] ${_staleCount} pesan lama saat bot offline dilewati.`);
    }
    _staleCount = 0;
    _lastStaleLog = now;
  }
}
import { checkAntiCrash } from "./antivirus.js";
import { checkAntilink } from "./antilink.js";
import { checkAntiBot } from "./antibot.js";
import { resolveCommandAccess } from "./access.js";
import { routeMultiBot } from "./route.js";
import { checkProfanityInput } from "./profanity.js";
import { checkPermits, checkRateLimit } from "./limits.js";
import { executeCommand } from "./execute.js";
import { runMediaHandlers } from "./media.js";
import { handleCustomCase } from "@/custom/cases.js";

export async function dispatchMessage(sock, msg, logger) {
  return db.runWithBot(resolveBotJid(sock), () => dispatchInner(sock, msg, logger));
}

async function dispatchInner(sock, msg, logger) {
  if (!msg.message || !msg.key?.id) return;

  const botJidEarly = resolveBotJid(sock);
  const botIdentity = resolveBotIdentity(sock);
  if (isDuplicateMessage(botIdentity, msg.key)) {
    logger?.info?.(`[Dedup] pesan duplikat diabaikan: ${msg.key?.id || "?"}`);
    return;
  }

  const rawMsg = msg.message;
  if (
    rawMsg &&
    (rawMsg.protocolMessage ||
      rawMsg.reactionMessage ||
      rawMsg.pollUpdateMessage ||
      rawMsg.senderKeyDistributionMessage)
  ) {
    return;
  }

  msg.message = extractMessageContent(unwrapMessageContent(msg.message));
  if (!msg.message) return;

  if (msg.message.protocolMessage || msg.message.reactionMessage) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast") return;
  const crashCandidate = msg.key.participant || remoteJid;
  if (!db.isOwner(crashCandidate) && !db.isOwner(remoteJid) && isCrashBlocked(crashCandidate)) {
    logger?.warn?.(`[CrashBlock] ${crashCandidate} sedang diblokir (payload sebelumnya mencurigakan)`);
    return;
  }

  if (remoteJid.endsWith("@newsletter") || remoteJid.endsWith("@broadcast")) return;

  const tapText = extractButtonText(msg.message) || "";
  const messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    tapText ||
    "";
  if (tapText) logger?.info?.(`[ButtonTap] ${remoteJid} -> ${tapText}`);

  try {
    const ts = Number(msg.messageTimestamp);
    if (Number.isFinite(ts) && ts > 0) {
      const isOwnerSender = db.isOwner(crashCandidate) || db.isOwner(remoteJid);
      const trimmedText = String(messageContent || "").trim();
      const isCommandLike = trimmedText.startsWith(".") || trimmedText.startsWith("/") || trimmedText.startsWith("#") || trimmedText.startsWith("!");

      // Toleransi umur pesan: jika pesan command dari user/owner, berikan jendela 3-5 menit (owner 5 menit, user 3 menit, pesan non-command biasa 2 menit)
      const maxAgeMs = isOwnerSender ? 5 * 60 * 1000 : (isCommandLike ? 3 * 60 * 1000 : 2 * 60 * 1000);
      const startupToleranceSec = isOwnerSender ? 300 : (isCommandLike ? 180 : 15);

      if (ts < PROCESS_START_TIME_SEC - startupToleranceSec) {
        logStaleThrottled(logger, Math.round(PROCESS_START_TIME_SEC - ts), msg.key?.id || "?");
        return;
      }

      const ageMs = Date.now() - ts * 1000;

      if (ageMs > maxAgeMs) {
        logStaleThrottled(logger, Math.round(ageMs / 1000), msg.key?.id || "?");
        return;
      }

      if (ageMs < -15 * 60 * 1000) {
        logger?.info?.(
          `[Stale] timestamp masa depan dilewati (selisih ${Math.round(ageMs / 1000)}s): ${msg.key?.id || "?"}`
        );
        return;
      }
    }
  } catch (_) {}

  if (await checkAntiCrash(sock, msg, logger, remoteJid, messageContent)) return;

  if (await checkAntilink(sock, msg, logger, remoteJid, messageContent)) return;

  const isFromMe = Boolean(msg.key?.fromMe);
  const botJid = botJidEarly || db.normalizeJid(sock.user?.id || "");

  const normalizedRawSender = resolveSenderJid(msg, botJid);

  if (botJid) {
    db.registerBotJid(botJid);
  }

  if (!isFromMe && !db.isOwner(normalizedRawSender) && !db.isOwner(remoteJid) && db.isAnyBotJid(normalizedRawSender)) {
    logger?.info?.(`[Drop] sender dianggap bot luar: ${normalizedRawSender} di ${remoteJid}`);
    return;
  }

  if (checkAntiBot(sock, msg, logger, { isFromMe, normalizedRawSender, messageContent, botJid })) return;

  const resolved = await resolveCommandAccess(sock, msg, {
    botJid,
    isFromMe,
    normalizedRawSender,
    messageContent,
    logger,
  });
  if (resolved.drop) {
    if (resolved.code === "not_command" && (await runMediaHandlers(sock, msg, logger))) {
      return;
    }
    if (tapText) logger?.info?.(`[ButtonTap] drop (unknown/blocked): ${tapText}`);
    else if (resolved.reason && !resolved.silent) {
      logger?.info?.(
        `[Drop] ${remoteJid} <- ${msg.pushName || "?"}: ${resolved.reason}` +
          (resolved.commandName ? ` (cmd: ${resolved.commandName})` : "")
      );
    } else if (resolved.reason && resolved.silent) {
      logger?.info?.(
        `[Drop-silent] ${remoteJid} <- ${msg.pushName || "?"} (${normalizedRawSender}, fromMe=${isFromMe}): ${resolved.reason}` +
          (resolved.commandName ? ` (cmd: ${resolved.commandName})` : "")
      );
    }
    return;
  }
  const { activeSettings, prefix, args, commandName, cmd, senderJid, isCustomCase } = resolved;
  const { isOwner, isAdmin, isPremium } = resolved;
  let { access, user } = resolved;

  if (isCustomCase) {
    const reply = async (text) => sock.sendMessage(remoteJid, { text: String(text) }, { quoted: msg });
    const sendTyping = async () => sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

    try {
      const handled = await handleCustomCase(commandName, {
        sock,
        msg,
        args,
        reply,
        sendTyping,
        isOwner,
        isAdmin,
        isPremium,
        prefix,
      });

      if (handled !== false) {
        logger?.info?.(`[CustomCase] dieksekusi: ${commandName} oleh ${senderJid}`);
        return;
      }
    } catch (err) {
      logger?.error?.(`[CustomCase-Error] ${commandName}: ${err.message}`);
      await reply(`[FAIL] Terjadi kesalahan pada case: ${err.message}`);
      return;
    }

    logger?.info?.(
      `[Drop] ${remoteJid} <- ${msg.pushName || "?"}: perintah tidak dikenal: ${commandName} (cmd: ${commandName})`
    );
    if (activeSettings.silentDeny === false) {
      await sock
        .sendMessage(
          remoteJid,
          { text: `⚠️ Perintah *${commandName}* tidak dikenal.\nKetik ${prefix}menu untuk daftar perintah.` },
          { quoted: msg }
        )
        .catch((err) =>
          logger?.warn?.(`[Run] Gagal kirim pesan "perintah tidak dikenal" ke ${remoteJid}: ${err?.message || err}`)
        );
    }
    return;
  }

  const isGroup = isGroupJid(remoteJid);

  const isSubBotSock = sock.isSubBot === true;
  if (isGroup && !isFromMe) {
    if (await routeMultiBot(sock, msg, { remoteJid, botJid, isSubBotSock, commandName, senderJid })) {
      logger?.info?.(`[Route] ditahan multi-bot (bot lain merespons): ${commandName} di ${remoteJid}`);
      return;
    }
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

  if (user.banned && !isOwner) {
    logger?.warn?.(`[Banned] perintah ${commandName} dari ${senderJid} ditolak (banned)`);
    return;
  }

  if (!isOwner) {
    if (await checkProfanityInput(sock, msg, logger, { remoteJid, senderJid, args })) return;
  }

  const deny = async (text) => {
    if (activeSettings.silentDeny === false) {
      await sock.sendMessage(remoteJid, { text }, { quoted: msg });
      return;
    }
    logger?.info?.(`[Deny-silent] ${commandName} <- ${senderJid}: ${String(text).slice(0, 80)}`);
  };

  if (await checkPermits(cmd, { isOwner, isAdmin, isPremium }, deny)) return;

  if (!isOwner) {
    if (await checkRateLimit(activeSettings, senderJid, sock, msg, remoteJid, cmd)) return;
  } else if (registerOwnerCommand(senderJid)) {
    logger?.warn?.(`[OwnerThrottle] ${senderJid} melebihi batas perintah owner via ${botJid}`);
    await sock
      .sendMessage(
        remoteJid,
        { text: `⏳ Terlalu banyak perintah owner. Tunggu 10 detik sebelum mengulangi.` },
        { quoted: msg }
      )
      .catch((err) => logger?.warn?.(`[Run] Gagal kirim pesan owner-throttle ke ${remoteJid}: ${err?.message || err}`));
    return;
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
