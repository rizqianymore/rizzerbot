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
  if (!a || !b) return false;
  if (a === b) return true;
  const da = getPhoneDigits(a);
  const dbb = getPhoneDigits(b);
  return Boolean(da && dbb && da === dbb);
}

function isSameBotJid(a, b) {
  return samePhoneJid(
    a ? db.normalizeJid(a) : "",
    b ? db.normalizeJid(b) : ""
  );
}

function resolveBotJid(sock) {
  const raw = sock?.user?.id || "";
  const norm = raw ? db.normalizeJid(raw) : "";
  if (norm) return norm;
  // Fallback sebelum login: pakai nomor sub agar dedup/setting tidak tercampur main
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

// Memory map untuk anti-spam & rate limiter per user
const userCooldowns = new Map();

// Anti-burst: hitung perintah per user dalam jendela 10 detik
const burstTracker = new Map(); // jid -> { count, windowStart, mutedUntil }
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

// Heuristik bot luar: pushName seperti bot + pola pesan command kaku
function looksLikeExternalBot(msg, text) {
  const name = String(msg?.pushName || "").toLowerCase();
  if (!name) return false;
  if (!/bot|assistant|official|support|ai\b/.test(name)) return false;
  // Pesan sangat kaku seperti output bot (banyak emoji + prefix command di dalam)
  if (text && text.length > 200 && /[✅❌⚠️📊👑]/.test(text)) return true;
  return /\bbot\b/.test(name);
}
// Anti-loop: cegah pesan yang sama diproses dua kali (retry / duplikat event)
// PENTING: key = botIdentity + messageId agar main & sub tidak saling
// memakan pesan satu sama lain (bug lama: global map membuat salah satu
// bot ke-skip secara acak). Arbitrasi "satu bot menjawab" diatur deterministik
// di bawah, bukan via race dedup.
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

// Ambil contextInfo dari SEMUA tipe pesan (bukan cuma extendedText),
// agar tag / reply kedeteksi juga di caption gambar/video/dokumen/dll.
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
  // Fallback: cari field apa pun yang punya contextInfo
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

  const botJid = resolveBotJid(sock);
  const botParticipant = meta.participants.find(
    (participant) => samePhoneJid(db.normalizeJid(participant.id), botJid)
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
      (participant) => samePhoneJid(db.normalizeJid(participant.id), senderJid)
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

// Tentukan bot mana yang berhak menjawab di grup agar TIDAK double reply.
// Aturan deterministik (disepakati semua bot sehingga hasilnya sama):
// 1. Kalau ada bot di-tag / di-reply -> hanya bot itu yang jawab.
// 2. Kalau tidak ada tag: hanya SATU bot yang jawab.
//    - Kalau main-bot ada di grup -> hanya main yang jawab.
//    - Kalau main tidak ada -> sub dengan nomor terkecil yang jawab.
// Ini memperbaiki bug lama "sub selalu diam" (grup berisi solo sub jadi mati total)
// sekaligus bug "dua-duanya jawab".
async function resolveGroupResponder(sock, remoteJid, botJid, isSubBot) {
  let meta = null;
  try {
    meta = await getCachedGroupMeta(sock, remoteJid);
  } catch (_) {
    meta = null;
  }
  if (!meta || !Array.isArray(meta.participants)) return { mode: "unknown" };

  const participantJids = meta.participants.map((p) => db.normalizeJid(p.id)).filter(Boolean);
  const botsInGroup = [];
  const seen = new Set();
  for (const pj of participantJids) {
    if (!db.isAnyBotJid(pj)) continue;
    const phone = getPhoneDigits(pj);
    if (phone && seen.has(phone)) continue;
    if (phone) seen.add(phone);
    botsInGroup.push(pj);
  }
  // Bot sendiri belum tentu terdeteksi via participants (format lid), tambahkan
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

  // Tanpa main: pilih sub nomor terkecil (deterministik)
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
  if (!msg.message || !msg.key?.id) return;

  const botJidEarly = resolveBotJid(sock);
  const botIdentity = resolveBotIdentity(sock);
  if (isDuplicateMessage(botIdentity, msg.key)) return;

  // Abaikan pesan sistem yang tidak boleh diproses (anti-loop / bug pesan)
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
  // Setelah unwrap, pastikan bukan sisa protocol/reaction
  if (msg.message.protocolMessage || msg.message.reactionMessage) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast") return;
  // Abaikan channel/newsletter & broadcast agar tidak loop / bug
  if (remoteJid.endsWith("@newsletter") || remoteJid.endsWith("@broadcast")) return;

  // Abaikan pesan lama (replay saat reconnect / restore) agar tidak spam loop.
  // Pesan > 2 menit dianggap basi dan tidak diproses sebagai command.
  try {
    const ts = Number(msg.messageTimestamp);
    if (Number.isFinite(ts) && ts > 0) {
      const ageMs = Date.now() - ts * 1000;
      if (ageMs > 2 * 60 * 1000) return;
      // Timestamp masa depan yang tidak wajar juga diabaikan
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

  // ── Guard 0: Anti-virtex / pesan raksasa ──
  // Diproses sebelum command agar crash-text tidak masuk ke plugin.
  {
    const _s = db.getSettings();
    if (_s.antiVirtex !== false) {
      const maxLen = Number(_s.maxMessageLength) || 5000;
      if (messageContent.length > maxLen) {
        logger?.warn?.(`[Anti-Virtex] Tolak pesan ${messageContent.length} char dari ${msg.key.participant || remoteJid}`);
        if (isGroupJid(remoteJid)) {
          try {
            await sock.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});
          } catch (_) {}
        }
        return;
      }
      // Pola crash: 1 char diulang ribuan kali / zalgo berlebihan
      if (/^(.)\1{2500,}$/s.test(messageContent.replace(/\s/g, ""))) {
        logger?.warn?.(`[Anti-Virtex] Pola crash terdeteksi, diabaikan.`);
        return;
      }
    }
  }

  // Proteksi Anti-Link Grup WhatsApp (diperluas)
  if (isGroupJid(remoteJid) && db.isAntilink(remoteJid)) {
    const basePattern = `chat\\.whatsapp\\.com\\/[A-Za-z0-9]{16,26}|whatsapp\\.com\\/channel\\/[A-Za-z0-9]+|wa\\.me\\/settings`;
    const extraPattern = db.getSettings()?.antilinkExtra !== false
      ? `|wa\\.me\\/[0-9]{8,16}|t\\.me\\/[A-Za-z0-9_]{3,}|discord\\.(gg|com\\/invite)\\/[A-Za-z0-9]+|telegram\\.me\\/[A-Za-z0-9_]{3,}`
      : ``;
    const linkRegex = new RegExp(`(${basePattern}${extraPattern})`, "i");
    if (linkRegex.test(messageContent)) {
      const rawSender = msg.key.participant || remoteJid;
      const senderJid = db.normalizeJid(rawSender);
      const isOwner = db.isOwner(senderJid);

      if (!isOwner) {
        // Cek apakah pengirim adalah admin grup
        const meta = await getCachedGroupMeta(sock, remoteJid).catch(() => null);
        const participant = meta?.participants?.find((p) => samePhoneJid(db.normalizeJid(p.id), senderJid));
        const isGroupAdmin = participant && (participant.admin === "admin" || participant.admin === "superadmin");

        if (!isGroupAdmin) {
          logger?.warn?.(`[Anti-Link] Menghapus link grup dari non-admin: ${senderJid} di grup ${remoteJid}`);
          try {
            // Hapus pesan pelanggar
            await sock.sendMessage(remoteJid, { delete: msg.key });
            // Kirim peringatan
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
  const rawSender = msg.key.participant || remoteJid;
  const normalizedRawSender = db.normalizeJid(rawSender);
  const remoteNormalized = db.normalizeJid(remoteJid);

  // Auto-register bot JID if known
  if (botJid) {
    db.registerBotJid(botJid);
  }

  // ── ANTI-LOOP SESAMA BOT ──
  // Jika pengirim adalah bot mana pun (main/sub/luar yang terdaftar),
  // JANGAN pernah diproses sebagai command. Ini memutus rantai:
  // bot A balas -> bot B baca -> bot B balas -> bot A baca -> dst.
  if (!isFromMe && db.isAnyBotJid(normalizedRawSender)) {
    return;
  }
  // Pesan eigenen (fromMe) yang berasal dari output bot lain yang di-forward
  // tetap diabaikan jika konteksnya jelas reply ke bot.
  // (fromMe asli milik owner tetap diproses di bawah sebagai owner.)

  // ── Guard 0b: Anti-bot luar (nomor terdaftar + heuristik) ──
  {
    const _g = db.getSettings();
    if (!isFromMe && _g.antiBotLuar !== false) {
      if (db.isExternalBotJid(normalizedRawSender)) {
        logger?.warn?.(`[Anti-Bot] Abaikan perintah dari bot luar: ${normalizedRawSender}`);
        return;
      }
      // Heuristik ringan: pushName mengandung "bot" + mengirim command → curigai bot, abaikan
      // (owner/admin dikecualikan agar bot kesayangan owner tetap bisa perintah)
      if (!db.isOwner(normalizedRawSender) && !db.isAdmin(normalizedRawSender) && looksLikeExternalBot(msg, messageContent) && messageContent.startsWith(_g.prefix || ".")) {
        logger?.warn?.(`[Anti-Bot] Heuristik bot luar cocok: ${normalizedRawSender} (${msg.pushName})`);
        return;
      }
    }
  }

  // Ambil pengaturan khusus bot ini (jika subbot, memiliki settings mandiri: prefix, public/self, owner khusus)
  // ISOLASI: self/public/prefix sub TIDAK ikut main, dan sebaliknya.
  const activeSettings = db.getBotSettings(botJid);
  const prefix = activeSettings.prefix || ".";
  if (!messageContent.startsWith(prefix)) return;

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return;

  const cmd = commands.get(commandName);
  if (!cmd) return;

  // Jika pesan berasal dari bot sendiri (isFromMe), atau nomornya sama dengan nomor bot
  const senderJid = isFromMe
    ? (botJid || normalizedRawSender)
    : normalizedRawSender;

  // Cek apakah pengirim adalah owner khusus untuk bot INI (1 bot 1 owner mandiri)
  const isSenderOwner =
    isFromMe ||
    db.isBotOwner(botJid, senderJid) ||
    (normalizedRawSender && db.isBotOwner(botJid, normalizedRawSender)) ||
    (rawSender && db.isBotOwner(botJid, rawSender)) ||
    (remoteNormalized && !isGroupJid(remoteJid) && db.isBotOwner(botJid, remoteNormalized));

  let user = db.getUser(senderJid);
  if (!user) return;

  let access = db.getAccess(senderJid);
  const isOwner = Boolean(isSenderOwner || access.owner);
  const isAdmin = Boolean(isOwner || access.admin);
  const isPremium = Boolean(isOwner || isAdmin || access.premium);

  // Jika bot dalam mode Self (public === false), HANYA Owner bot ini yang diizinkan merespon
  // (setting ini per-bot: self di sub tidak mematikan main, dan sebaliknya)
  if (activeSettings.public === false && !isOwner) {
    return;
  }

  // DISAMBIGUASI MULTI-BOT DI GRUP (agar hanya SATU yang menjawab):
  const isGroup = isGroupJid(remoteJid);
  // Sumber kebenaran sub vs main: flag socket (bukan tebakan nomor)
  const isSubBotSock = sock.isSubBot === true;
  if (isGroup && !isFromMe) {
    const uniCtx = getUniversalContextInfo(msg.message) || {};
    const mentionedJids = (uniCtx.mentionedJid || []).map((j) => db.normalizeJid(j));
    const quotedParticipant = db.normalizeJid(uniCtx.participant || "");

    // Cek apakah ada bot terdaftar yang di-tag atau di-reply
    const anyBotMentioned = mentionedJids.some((j) => db.isAnyBotJid(j));
    const quotedIsBot = Boolean(quotedParticipant) && db.isAnyBotJid(quotedParticipant);
    const isTaggedHere = mentionedJids.some((j) => isSameBotJid(j, botJid));
    const isQuotedHere = Boolean(quotedParticipant && isSameBotJid(quotedParticipant, botJid));

    // 1. Tagging: Jika bot terdaftar di-tag (mentioned), HANYA bot yang di-tag yang boleh merespon.
    if (anyBotMentioned && !isTaggedHere) {
      return;
    }

    // 2. Quoted / Reply: Jika pesan me-reply pesan dari bot tertentu, HANYA bot tersebut yang merespon
    if (quotedIsBot && !isQuotedHere) {
      return;
    }

    // 3. Tanpa Tag / Mention dan Tanpa Reply ke Bot Tertentu:
    //    Hanya SATU bot yang menjawab (deterministik, disepakati semua bot).
    if (!anyBotMentioned && !quotedIsBot) {
      const ownerCommands = ["self", "public", "pub", "setprefix", "delbot", "syncsubbot", "vps"];

      if (ownerCommands.includes(commandName)) {
        // Perintah owner di grup TANPA tag/reply:
        // - Sub tidak merespon (owner sub pakai DM/tag ke sub agar tidak bocor ke main).
        // - Main hanya merespon jika pengirim adalah Primary SuperOwner.
        // Ini mencegah setting self/public sub tercampur main.
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
        // Perintah umum di grup tanpa tag: arbitrasi peserta-aware.
        const verdict = await resolveGroupResponder(sock, remoteJid, botJid, isSubBotSock);
        if (verdict.mode === "multi-main-present" || verdict.mode === "multi-sub-only") {
          if (!verdict.shouldRespond) return;
        } else if (verdict.mode === "unknown") {
          // Fallback aman saat metadata gagal: sub diam agar tidak double dengan main.
          if (isSubBotSock) {
            return;
          }
        }
        // mode solo: bot satu-satunya -> jawab (termasuk solo sub).
      }
    }
  }

  // Jika grup dan pesan BUKAN dari owner bot ini, cek apakah bot ini yang dimaksud
  // (Jika bot dalam mode self atau user bukan owner, bot tidak merespon perintah orang lain)
  if (isOwner && (!user.owner || !user.premium || user.role !== "owner")) {
    user = db.updateUser(senderJid, {
      owner: true,
      admin: true,
      premium: true,
      banned: false,
      role: "owner",
    });
    access = db.getAccess(senderJid);
  }

  if (msg.pushName && user.name !== msg.pushName) {
    user = db.updateUser(senderJid, { name: msg.pushName });
    access = db.getAccess(senderJid);
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

  if (cmd.ownerOnly && !isOwner) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk Owner!" }, { quoted: msg });
  }

  if (cmd.adminOnly && !isAdmin) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk Admin Bot!" }, { quoted: msg });
  }

  if (cmd.premiumOnly && !isPremium) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk pengguna Premium!" }, { quoted: msg });
  }

  // Anti-Spam / Rate Limiter + Anti-Burst per User (Owner kebal)
  if (!isOwner) {
    // Burst: >6 perintah / 10 detik → mute 60 detik
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

    // Auto clean memory map jika membesar > 1000 entri
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
    return sock.sendMessage(remoteJid, { text: groupAccessError }, { quoted: msg });
  }

  logger?.info?.(`[Command] ${cmd.name} from ${msg.pushName || "User"} (${senderJid}) via ${isSubBotSock ? "sub" : "main"} (${botJid})`);
  db.recordCommand(cmd.name);

  const responseDelay = Number(activeSettings.responseDelay) || 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isPrimarySuperOwner = db.isPrimaryOwner(senderJid);
  // Sumber kebenaran sub vs main: flag socket
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
      if (quotedJid && !quotedJid.endsWith("@g.us")) {
        return db.normalizeJid(quotedJid);
      }

      const mentioned = _ctx.mentionedJid;
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
