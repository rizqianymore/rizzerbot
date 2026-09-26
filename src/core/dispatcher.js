import { extractMessageContent } from "baileys";
import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { getCachedGroupMeta } from "@/src/utils/helper.js";

function isGroupJid(jid) {
  return Boolean(jid?.endsWith("@g.us"));
}

function getPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isPhoneJid(jid, minimumDigits = 10) {
  return Boolean(
    jid &&
      jid.endsWith("@s.whatsapp.net") &&
      getPhoneDigits(jid).length >= minimumDigits
  );
}

function findPhoneJid(values) {
  const parts = (Array.isArray(values) ? values : String(values || "").trim().split(/[\s,;]+/))
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (let start = 0; start < parts.length; start += 1) {
    const directValue = parts[start];
    if (directValue.includes("@") || directValue.startsWith("+")) {
      const directJid = db.normalizeJid(directValue);
      const explicitJid = directValue.includes("@") && directValue.indexOf("@", 1) >= 0;
      if (directJid && !directJid.endsWith("@g.us") && (explicitJid || isPhoneJid(directJid))) return directJid;
    }

    let candidate = "";
    for (let end = start; end < Math.min(parts.length, start + 4); end += 1) {
      candidate = candidate ? `${candidate} ${parts[end]}` : parts[end];
      const jid = db.normalizeJid(candidate);
      if (isPhoneJid(jid)) return jid;
    }
  }

  return null;
}

async function getGroupAccessError(sock, remoteJid, senderJid, cmd, access) {
  if (!cmd.groupOnly && !cmd.groupAdminOnly && !cmd.botAdminOnly) return null;

  if (!isGroupJid(remoteJid)) {
    return "❌ Perintah ini hanya dapat digunakan di dalam grup!";
  }

  if (access.owner) return null;
  if (!cmd.groupAdminOnly && !cmd.botAdminOnly) return null;

  const meta = await getCachedGroupMeta(sock, remoteJid);
  if (!meta || !Array.isArray(meta.participants)) {
    return "❌ Gagal mengambil informasi grup WhatsApp.";
  }

  const botJid = db.normalizeJid(sock.user?.id);
  const botParticipant = meta.participants.find(
    (participant) => db.normalizeJid(participant.id) === botJid
  );
  const isBotAdmin = Boolean(
    botParticipant &&
    (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  if (cmd.botAdminOnly && !isBotAdmin) {
    return "❌ Jadikan bot sebagai Admin grup terlebih dahulu!";
  }

  if (cmd.groupAdminOnly) {
    const userParticipant = meta.participants.find(
      (participant) => db.normalizeJid(participant.id) === senderJid
    );
    const isGroupAdmin = Boolean(
      access.admin ||
        (userParticipant &&
          (userParticipant.admin === "admin" || userParticipant.admin === "superadmin"))
    );
    if (!isGroupAdmin) {
      return "❌ Fitur ini hanya untuk Admin Grup, Admin Bot, atau Owner Bot!";
    }
  }

  return null;
}

export async function dispatchMessage(sock, msg, logger) {
  if (!msg.message || !msg.key?.id) return;

  msg.message = extractMessageContent(msg.message);
  if (!msg.message) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast") return;

  const messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    "";

  const activeSettings = db.getSettings();
  const prefix = activeSettings.prefix || ".";
  if (!messageContent.startsWith(prefix)) return;

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return;

  const cmd = commands.get(commandName);
  if (!cmd) return;

  const isFromMe = Boolean(msg.key?.fromMe);
  const botRawId = sock.user?.id || "";
  const botJid = db.normalizeJid(botRawId);
  const rawSender = msg.key.participant || remoteJid;
  const normalizedRawSender = db.normalizeJid(rawSender);
  const remoteNormalized = db.normalizeJid(remoteJid);

  // Auto-register bot JID if known
  if (botJid) {
    db.registerBotJid(botJid);
  }

  // Jika pesan berasal dari bot sendiri (isFromMe), atau nomornya sama dengan nomor bot
  const senderJid = isFromMe
    ? (botJid || normalizedRawSender)
    : normalizedRawSender;

  // Cek apakah pengirim adalah owner atau nomor bot itu sendiri
  const isSenderOwner =
    isFromMe ||
    db.isOwner(senderJid) ||
    db.isOwner(normalizedRawSender) ||
    db.isOwner(rawSender) ||
    db.isOwner(remoteNormalized) ||
    (botJid && (senderJid === botJid || normalizedRawSender === botJid || remoteNormalized === botJid));

  let user = db.getUser(senderJid);
  if (!user) return;

  let access = db.getAccess(senderJid);
  const isOwner = Boolean(isSenderOwner || access.owner);
  const isAdmin = Boolean(isOwner || access.admin);
  const isPremium = Boolean(isOwner || isAdmin || access.premium);

  if (activeSettings.public === false && !isOwner) return;

  if (isOwner && !user.owner) {
    user = db.updateUser(senderJid, { owner: true, admin: true, premium: true, banned: false });
    access = db.getAccess(senderJid);
  }

  if (msg.pushName && user.name !== msg.pushName) {
    user = db.updateUser(senderJid, { name: msg.pushName });
    access = db.getAccess(senderJid);
  }

  if (user.banned && !isOwner) return;

  if (!isOwner) {
    const { checkProfanity } = await import("@/src/utils/filter.js");
    const quotedText =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption ||
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
            `⚠️ *PERINGATAN: KONTEN TERLARANG!*\n\n` +
            `Pesan Anda mengandung kata atau permintaan konten terlarang 18+ (*"${check.matchedWord}"*).\n` +
            `Permintaan dibatalkan. Harap gunakan bot secara bijak.`
        },
        { quoted: msg }
      );
      return;
    }
  }

  if (cmd.ownerOnly && !isOwner) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk Owner!" }, { quoted: msg });
  }

  if (cmd.adminOnly && !isAdmin) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk Admin Bot!" }, { quoted: msg });
  }

  if (cmd.premiumOnly && !isPremium) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk pengguna Premium!" }, { quoted: msg });
  }

  const groupAccessError = await getGroupAccessError(
    sock,
    remoteJid,
    senderJid,
    cmd,
    access
  );
  if (groupAccessError) {
    return sock.sendMessage(remoteJid, { text: groupAccessError }, { quoted: msg });
  }

  logger?.info?.(`[Command] ${cmd.name} from ${msg.pushName || "User"} (${senderJid})`);
  db.recordCommand(cmd.name);

  const responseDelay = Number(activeSettings.responseDelay) || 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const context = {
    logger,
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
    quoted: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
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
      const quotedJid =
        msg.message?.extendedTextMessage?.contextInfo?.participant ||
        msg.message?.extendedTextMessage?.contextInfo?.remoteJid;
      if (quotedJid && !quotedJid.endsWith("@g.us")) {
        return db.normalizeJid(quotedJid);
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (Array.isArray(mentioned)) {
        for (const candidate of mentioned) {
          const normalized = db.normalizeJid(candidate);
          if (normalized) return normalized;
        }
      } else if (mentioned) {
        const normalized = db.normalizeJid(mentioned);
        if (normalized) return normalized;
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
