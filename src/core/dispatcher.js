import { extractMessageContent } from "baileys";
import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { getCachedGroupMeta } from "@/src/utils/helper.js";

function isGroupJid(jid) {
  return Boolean(jid?.endsWith("@g.us"));
}

function getPhoneDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function samePhoneJid(a, b) {
  return db.sameUser(a, b);
}

function isSameBotJid(a, b) {
  return db.sameUser(a, b);
}

function findParticipant(meta, jid) {
  const parts = meta?.participants || [];
  for (const p of parts) {
    if (!p) continue;
    const cands = typeof p === "string" ? [p] : [p.id, p.phoneNumber, p.lid];
    for (const c of cands) {
      if (c && db.sameUser(c, jid)) return p;
    }
  }
  return null;
}

function resolveSenderJid(msg) {
  const key = msg?.key || {};
  const primary = db.normalizeJid(key.participant || "");
  const remote = db.normalizeJid(key.remoteJid || "");
  const alt = db.pickPhoneJid(key.participantAlt, key.remoteJidAlt, key.participantPn, key.senderPn);
  if (primary.endsWith("@lid") && alt) db.rememberLidPn(primary, alt);
  if (alt) return alt;
  if (primary) {
    const viaMap = db.resolvePhoneJid(primary);
    if (viaMap.endsWith("@s.whatsapp.net")) return viaMap;

    if (!isGroupJid(key.remoteJid) && remote.endsWith("@s.whatsapp.net")) {
      if (primary.endsWith("@lid")) db.rememberLidPn(primary, remote);
      return remote;
    }
    if (viaMap) return viaMap;
    return primary;
  }
  if (!isGroupJid(key.remoteJid) && remote) return db.resolvePhoneJid(remote);
  return remote;
}

function resolveBotJid(sock) {
  const raw = sock?.user?.id || "";
  const norm = raw ? db.normalizeJid(raw) : "";
  if (norm) return norm;

  if (sock?.isSubBot && sock?.subBotNumber) {
    return db.normalizeJid(`${String(sock.subBotNumber).replace(/\D/g, "")}@s.whatsapp.net`);
  }
  return "";
}

function resolveBotIdentity(sock) {
  const jid = resolveBotJid(sock);
  if (jid) return jid;
  if (sock?.isSubBot) return `sub_${sock?.subBotNumber || "unknown"}`;
  return "main";
}

const userCooldowns = new Map();

const burstTracker = new Map();
const BURST_WINDOW_MS = 10 * 1000;
const BURST_MAX = 6;
const BURST_MUTE_MS = 60 * 1000;

function isBurstMuted(jid) {
  const now = Date.now();
  const rec = burstTracker.get(jid);
  if (!rec) return false;
  if (rec.mutedUntil && now < rec.mutedUntil) return rec.mutedUntil;
  if (now - rec.windowStart > BURST_WINDOW_MS) {
    burstTracker.delete(jid);
    return false;
  }
  return false;
}

function registerBurst(jid) {
  const now = Date.now();
  let rec = burstTracker.get(jid);
  if (!rec || now - rec.windowStart > BURST_WINDOW_MS) {
    rec = { count: 1, windowStart: now, mutedUntil: 0 };
  } else {
    rec.count += 1;
  }
  if (rec.count > BURST_MAX) {
    rec.mutedUntil = now + BURST_MUTE_MS;
  }
  burstTracker.set(jid, rec);
  if (burstTracker.size > 2000) {
    for (const [k, v] of burstTracker.entries()) {
      if (now - v.windowStart > BURST_WINDOW_MS && (!v.mutedUntil || now > v.mutedUntil)) {
        burstTracker.delete(k);
      }
    }
  }
  return rec;
}

const crashSenders = new Map();
function trackCrashSender(jid) {
  if (!jid) return;
  const now = Date.now();
  const rec = crashSenders.get(jid) || { count: 0, first: now, blockedUntil: 0 };
  if (now - rec.first > 60 * 1000) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= 3) rec.blockedUntil = now + 5 * 60 * 1000;
  crashSenders.set(jid, rec);
  if (crashSenders.size > 1000) {
    for (const [k, v] of crashSenders.entries()) {
      if (now > v.blockedUntil && now - v.first > 60 * 1000) crashSenders.delete(k);
    }
  }
}
function isCrashBlocked(jid) {
  const rec = crashSenders.get(jid);
  return Boolean(rec && Date.now() < rec.blockedUntil);
}

function looksLikeExternalBot(msg, text) {
  const name = String(msg?.pushName || "").toLowerCase();
  if (!name) return false;
  if (!/bot|assistant|official|support|ai\b/.test(name)) return false;

  if (text && text.length > 200 && /[✅❌⚠️📊👑]/.test(text)) return true;
  return /\bbot\b/.test(name);
}

const seenMessageIds = new Map();
function isDuplicateMessage(botIdentity, key) {
  const id = key?.id;
  if (!id) return false;
  const mapKey = `${botIdentity}::${id}`;
  const now = Date.now();
  const last = seenMessageIds.get(mapKey);
  if (last && now - last < 5 * 60 * 1000) return true;
  seenMessageIds.set(mapKey, now);
  if (seenMessageIds.size > 4000) {
    for (const [k, t] of seenMessageIds.entries()) {
      if (now - t > 5 * 60 * 1000) seenMessageIds.delete(k);
    }
  }
  return false;
}

function getUniversalContextInfo(message) {
  if (!message || typeof message !== "object") return null;
  const candidates = [
    message.conversation,
    message.extendedTextMessage,
    message.imageMessage,
    message.videoMessage,
    message.documentMessage,
    message.documentWithCaptionMessage?.message?.documentMessage,
    message.stickerMessage,
    message.audioMessage,
    message.buttonsResponseMessage,
    message.listResponseMessage,
    message.templateButtonReplyMessage,
    message.interactiveResponseMessage,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && c.contextInfo) return c.contextInfo;
  }

  for (const v of Object.values(message)) {
    if (v && typeof v === "object" && v.contextInfo) return v.contextInfo;
  }
  return null;
}

function getPhoneDigitsFn(value) {
  return String(value || "").replace(/\D/g, "");
}

function isPhoneJid(jid, minimumDigits = 10) {
  return Boolean(
    jid &&
    jid.endsWith("@s.whatsapp.net") &&
    getPhoneDigitsFn(jid).length >= minimumDigits
  );
}

function findPhoneJid(values) {
  const parts = (Array.isArray(values) ? values : String(values || "").trim().split(/[\s,;]+/))
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (let start = 0; start < parts.length; start += 1) {
    const directValue = parts[start];
    if (directValue.includes("@") || directValue.startsWith("+")) {

      const directJid = db.resolvePhoneJid(directValue);
      const explicitJid = directValue.includes("@") && directValue.indexOf("@", 1) >= 0;
      if (directJid && !directJid.endsWith("@g.us") && directJid.endsWith("@s.whatsapp.net") && (explicitJid || isPhoneJid(directJid))) return directJid;
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

  const botJid = resolveBotJid(sock);
  const botParticipant = findParticipant(meta, botJid);
  const isBotAdmin = Boolean(
    botParticipant &&
    (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  if (cmd.botAdminOnly && !isBotAdmin) {
    return "❌ Jadikan bot sebagai Admin grup terlebih dahulu!";
  }

  if (cmd.groupAdminOnly) {
    const userParticipant = findParticipant(meta, senderJid);
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

async function resolveGroupResponder(sock, remoteJid, botJid, isSubBot) {
  let meta = null;
  try {
    meta = await getCachedGroupMeta(sock, remoteJid);
  } catch (_) {
    meta = null;
  }
  if (!meta || !Array.isArray(meta.participants)) return { mode: "unknown" };

  const botsInGroup = [];
  const seen = new Set();
  const considerBotJid = (rawJid) => {
    const pj = db.resolvePhoneJid(rawJid);
    if (!pj) return;
    if (!db.isAnyBotJid(pj)) return;
    const phone = pj.endsWith("@s.whatsapp.net") ? getPhoneDigits(pj) : pj;
    if (phone && seen.has(phone)) return;
    if (phone) seen.add(phone);
    botsInGroup.push(pj);
  };
  for (const p of meta.participants) {
    if (!p) continue;
    if (typeof p === "string") {
      considerBotJid(p);
      continue;
    }
    considerBotJid(p.id);
    considerBotJid(p.phoneNumber);
    considerBotJid(p.lid);
  }

  if (botJid && !botsInGroup.some((b) => samePhoneJid(b, botJid))) {
    botsInGroup.push(botJid);
  }

  if (botsInGroup.length <= 1) return { mode: "solo", botsInGroup };

  let mainJid = "";
  try {
    mainJid = db.getMainBotJid ? db.getMainBotJid() : "";
  } catch (_) {}
  const mainInGroup = mainJid ? botsInGroup.some((b) => samePhoneJid(b, mainJid)) : false;

  if (mainInGroup) {
    const iAmMain = mainJid ? samePhoneJid(botJid, mainJid) : !isSubBot;
    return { mode: "multi-main-present", botsInGroup, mainJid, shouldRespond: iAmMain };
  }

  const sorted = [...botsInGroup].sort((a, b) => {
    const pa = getPhoneDigits(a);
    const pb = getPhoneDigits(b);
    if (pa === pb) return 0;
    return pa < pb ? -1 : 1;
  });
  const winner = sorted[0];
  return {
    mode: "multi-sub-only",
    botsInGroup,
    winner,
    shouldRespond: samePhoneJid(botJid, winner),
  };
}

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
    "";

  {
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
        return;
      }

      if (/^(.)\1{2500,}$/s.test(messageContent.replace(/\s/g, ""))) {
        logger?.warn?.(`[Anti-Crash L2] Pola 1-char flood`);
        await dropInGroup();
        return;
      }

      let rawStr = "";
      try {
        rawStr = JSON.stringify(msg.message) || "";
      } catch (_) {}
      if (rawStr.length > LIMIT.rawBytes) {
        logger?.warn?.(`[Anti-Crash L3] Payload ${rawStr.length} byte`);
        await dropInGroup();
        trackCrashSender(msg.key.participant || remoteJid);
        return;
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
      const flood = rawStr.length > LIMIT.rawScan &&
        /\\u0000(\\u0000){20,}|ꦾ{5000,}|𑇂{1000,}/.test(rawStr);
      if (crashKey || flood || vcardLen > LIMIT.vcard || extLen > LIMIT.extText || btnCount > LIMIT.buttons) {
        logger?.warn?.(`[Anti-Crash L4] crashKey=${Boolean(crashKey)} flood=${flood} vcard=${vcardLen} ext=${extLen} btn=${btnCount}`);
        await dropInGroup();
        trackCrashSender(msg.key.participant || remoteJid);
        return;
      }
    }
  }

  if (isGroupJid(remoteJid) && db.isAntilink(remoteJid)) {
    const basePattern = `chat\\.whatsapp\\.com\\/[A-Za-z0-9]{16,26}|whatsapp\\.com\\/channel\\/[A-Za-z0-9]+|wa\\.me\\/settings`;
    const extraPattern = db.getSettings()?.antilinkExtra !== false
      ? `|wa\\.me\\/[0-9]{8,16}|t\\.me\\/[A-Za-z0-9_]{3,}|discord\\.(gg|com\\/invite)\\/[A-Za-z0-9]+|telegram\\.me\\/[A-Za-z0-9_]{3,}`
      : ``;
    const linkRegex = new RegExp(`(${basePattern}${extraPattern})`, "i");
    if (linkRegex.test(messageContent)) {
      const senderJid = resolveSenderJid(msg);
      const isOwner = db.isOwner(senderJid);

      if (!isOwner) {

        const meta = await getCachedGroupMeta(sock, remoteJid).catch(() => null);
        const participant = findParticipant(meta, senderJid);
        const isGroupAdmin = participant && (participant.admin === "admin" || participant.admin === "superadmin");

        if (!isGroupAdmin) {
          logger?.warn?.(`[Anti-Link] Menghapus link grup dari non-admin: ${senderJid} di grup ${remoteJid}`);
          try {

            await sock.sendMessage(remoteJid, { delete: msg.key });

            await sock.sendMessage(remoteJid, {
              text: `⚠️ *Anti-Link*\n\nMaaf @${senderJid.split("@")[0]}, dilarang mengirim tautan grup WhatsApp di sini. Pesan Anda telah dihapus.`,
              mentions: [senderJid],
            });
          } catch (_) { }
          return;
        }
      }
    }
  }

  const isFromMe = Boolean(msg.key?.fromMe);
  const botJid = botJidEarly || db.normalizeJid(sock.user?.id || "");

  const normalizedRawSender = resolveSenderJid(msg);
  const rawSender = normalizedRawSender;
  const remoteNormalized = db.resolvePhoneJid(remoteJid);

  if (botJid) {
    db.registerBotJid(botJid);
  }

  if (!isFromMe && db.isAnyBotJid(normalizedRawSender)) {
    return;
  }

  {
    const _g = db.getSettings();
    if (!isFromMe && _g.antiBotLuar !== false) {
      if (db.isExternalBotJid(normalizedRawSender)) {
        logger?.warn?.(`[Anti-Bot] Abaikan perintah dari bot luar: ${normalizedRawSender}`);
        return;
      }

      if (!db.isOwner(normalizedRawSender) && !db.isAdmin(normalizedRawSender) && looksLikeExternalBot(msg, messageContent) && messageContent.startsWith(_g.prefix || ".")) {
        logger?.warn?.(`[Anti-Bot] Heuristik bot luar cocok: ${normalizedRawSender} (${msg.pushName})`);
        return;
      }
    }
  }

  const activeSettings = db.getBotSettings(botJid);
  const prefix = activeSettings.prefix || ".";
  if (!messageContent.startsWith(prefix)) return;

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return;

  const cmd = commands.get(commandName);
  if (!cmd) return;

  const senderJid = isFromMe
    ? (botJid || normalizedRawSender)
    : normalizedRawSender;

  const isSenderOwner =
    isFromMe ||
    db.isBotOwner(botJid, senderJid) ||
    (normalizedRawSender && db.isBotOwner(botJid, normalizedRawSender)) ||
    (rawSender && db.isBotOwner(botJid, rawSender)) ||
    (remoteNormalized && !isGroupJid(remoteJid) && db.isBotOwner(botJid, remoteNormalized));

  let access = db.getAccess(senderJid);
  const isOwner = Boolean(isSenderOwner || access.owner);
  const isAdmin = Boolean(isOwner || access.admin);
  const isPremium = Boolean(isOwner || isAdmin || access.premium);
  const isRegistered = Boolean(isOwner || isAdmin || isPremium);

  if (activeSettings.public === false && !isOwner) {
    return;
  }

  if (activeSettings.maintenance === true && !isOwner) {
    if (activeSettings.silentDeny === false) {
      const mtext = String(activeSettings.maintenanceMessage || "🔧 Bot sedang maintenance. Coba lagi nanti.");
      await sock.sendMessage(remoteJid, { text: mtext }, { quoted: msg }).catch(() => {});
    }
    return;
  }

  if (!isRegistered && !isGroupJid(remoteJid)) {
    const allowed = Array.isArray(activeSettings.publicCommands)
      ? activeSettings.publicCommands.map((c) => String(c || "").toLowerCase())
      : [];
    const invoked = new Set(
      [commandName, cmd.name?.toLowerCase(), ...((cmd.aliases || []).map((a) => String(a || "").toLowerCase()))]
        .filter(Boolean)
    );
    const isPublicCommand = [...invoked].some((n) => allowed.includes(n));
    if (!isPublicCommand) return;
  }

  let user = access.user || {
    name: msg.pushName || "",
    owner: false,
    admin: false,
    premium: false,
    banned: false,
    role: "user",
  };

  const isGroup = isGroupJid(remoteJid);

  const isSubBotSock = sock.isSubBot === true;
  if (isGroup && !isFromMe) {
    const uniCtx = getUniversalContextInfo(msg.message) || {};

    const mentionedJids = (uniCtx.mentionedJid || []).map((j) => db.resolvePhoneJid(j)).filter(Boolean);
    const quotedParticipant = db.resolvePhoneJid(uniCtx.participant || "");

    const anyBotMentioned = mentionedJids.some((j) => db.isAnyBotJid(j));
    const quotedIsBot = Boolean(quotedParticipant) && db.isAnyBotJid(quotedParticipant);
    const isTaggedHere = mentionedJids.some((j) => isSameBotJid(j, botJid));
    const isQuotedHere = Boolean(quotedParticipant && isSameBotJid(quotedParticipant, botJid));

    if (anyBotMentioned && !isTaggedHere) {
      return;
    }

    if (quotedIsBot && !isQuotedHere) {
      return;
    }

    if (!anyBotMentioned && !quotedIsBot) {
      const ownerCommands = ["self", "public", "pub", "setprefix", "delbot", "syncsubbot", "vps"];

      if (ownerCommands.includes(commandName)) {

        if (isSubBotSock) {
          return;
        }
        if (!isSubBotSock) {
          const isMainOwner = db.isPrimaryOwner(senderJid);
          if (!isMainOwner) {
            return;
          }
        }
      } else {

        const verdict = await resolveGroupResponder(sock, remoteJid, botJid, isSubBotSock);
        if (verdict.mode === "multi-main-present" || verdict.mode === "multi-sub-only") {
          if (!verdict.shouldRespond) return;
        } else if (verdict.mode === "unknown") {

          if (isSubBotSock) {
            return;
          }
        }

      }
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

  if (user.banned && !isOwner) return;

  if (!isOwner) {
    const { checkProfanity } = await import("@/src/utils/filter.js");
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
            `Permintaan dibatalkan.`
        },
        { quoted: msg }
      );
      return;
    }
  }

  const deny = async (text) => {
    if (activeSettings.silentDeny !== false) return;
    await sock.sendMessage(remoteJid, { text }, { quoted: msg });
  };

  if (cmd.ownerOnly && !isOwner) {
    return deny("❌ Fitur ini hanya untuk Owner!");
  }

  if (cmd.adminOnly && !isAdmin) {
    return deny("❌ Fitur ini hanya untuk Admin Bot!");
  }

  if (cmd.premiumOnly && !isPremium) {
    return deny("❌ Fitur ini hanya untuk pengguna Premium!");
  }

  if (!isOwner) {

    if (activeSettings.antiBurst !== false) {
      const mutedUntil = isBurstMuted(senderJid);
      if (mutedUntil) {
        const sisa = Math.ceil((mutedUntil - Date.now()) / 1000);
        return sock.sendMessage(
          remoteJid,
          { text: `🚫 *Spam terdeteksi!* Tunggu ${sisa} detik sebelum perintah lagi.` },
          { quoted: msg }
        );
      }
      const rec = registerBurst(senderJid);
      if (rec.mutedUntil && Date.now() < rec.mutedUntil) {
        return sock.sendMessage(
          remoteJid,
          { text: `🚫 *Spam burst terdeteksi!* Kamu dimute 60 detik.` },
          { quoted: msg }
        );
      }
    }
    const cooldownMs = Number(activeSettings.cooldownTime) || 3000;
    const now = Date.now();
    const lastTime = userCooldowns.get(senderJid) || 0;
    const diff = now - lastTime;

    if (diff < cooldownMs) {
      const waitSec = ((cooldownMs - diff) / 1000).toFixed(1);
      return sock.sendMessage(
        remoteJid,
        { text: `⏳ *Mohon tunggu ${waitSec} detik* sebelum menggunakan perintah berikutnya!` },
        { quoted: msg }
      );
    }
    userCooldowns.set(senderJid, now);

    if (userCooldowns.size > 1000) {
      for (const [jid, time] of userCooldowns.entries()) {
        if (now - time > cooldownMs * 2) {
          userCooldowns.delete(jid);
        }
      }
    }
  }

  const groupAccessError = await getGroupAccessError(
    sock,
    remoteJid,
    senderJid,
    cmd,
    access
  );
  if (groupAccessError) {
    if (activeSettings.silentDeny !== false) return;
    return sock.sendMessage(remoteJid, { text: groupAccessError }, { quoted: msg });
  }

  logger?.info?.(`[Command] ${cmd.name} from ${msg.pushName || "User"} (${senderJid}) via ${isSubBotSock ? "sub" : "main"} (${botJid})`);
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
    quoted: (getUniversalContextInfo(msg.message)?.quotedMessage) || null,
    sendTyping: async () => {
      Promise.resolve(sock.sendPresenceUpdate?.("composing", remoteJid)).catch(() => { });
    },
    reply: async (text) => {
      if (responseDelay > 0) {
        Promise.resolve(sock.sendPresenceUpdate?.("composing", remoteJid)).catch(() => { });
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
      const mentionedList = Array.isArray(mentioned) ? mentioned : (mentioned ? [mentioned] : []);
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
