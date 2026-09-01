import { db } from "@/src/core/database.js";

// Pola Payload Virtex / Crash / Freeze String
const SUSPICIOUS_PATTERNS = [
  /[\u200B-\u200D\uFEFF]/g, // Zero width unicode spam
  /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]{200,}/, // Arabic script overload / crash fonts
  /[\u0E00-\u0E7F]{300,}/, // Thai stack overflow scripts
  /(.)\1{1000,}/, // Repeated single character overflow (>1000 chars)
];

const MAX_SAFE_TEXT_LENGTH = 15000; // 15KB max normal text
const MAX_ZERO_WIDTH_CHARS = 30;

export function inspectPayloadSecurity(sock, msg, messageContent, senderJid, remoteJid, isOwner, logger) {
  if (isOwner || msg.key?.fromMe) return false;

  let isMalicious = false;
  let reason = "";

  // 1. Cek ukuran panjang string teks abnormal
  if (messageContent && messageContent.length > MAX_SAFE_TEXT_LENGTH) {
    isMalicious = true;
    reason = `Pesan teks melebihi batas aman (${messageContent.length} karakter).`;
  }

  // 2. Cek akumulasi karakter tak terlihat / zero-width space overload
  if (!isMalicious && messageContent) {
    const zeroWidthMatches = messageContent.match(/[\u200B-\u200F\u202A-\u202E\uFEFF\u2060]/g);
    if (zeroWidthMatches && zeroWidthMatches.length > MAX_ZERO_WIDTH_CHARS) {
      isMalicious = true;
      reason = `Injeksi Zero-Width Unicode tersembunyi (${zeroWidthMatches.length} karakter).`;
    }
  }

  // 3. Cek crash strings / overload scripts
  if (!isMalicious && messageContent) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(messageContent)) {
        isMalicious = true;
        reason = "Pola teks crash / overload terdeteksi.";
        break;
      }
    }
  }

  // 4. Cek Malformed VCard / Contact spam crash
  if (!isMalicious && msg.message?.contactMessage) {
    const vcard = msg.message.contactMessage.vcard || "";
    if (vcard.length > 5000 || /[\u0E00-\u0E7F]{100,}/.test(vcard)) {
      isMalicious = true;
      reason = "Malformed VCard Contact payload.";
    }
  }

  // 5. Cek Malformed List / Button message crash
  if (!isMalicious && msg.message?.listMessage) {
    const sections = msg.message.listMessage.sections || [];
    let totalRows = 0;
    for (const sec of sections) {
      totalRows += sec.rows?.length || 0;
    }
    if (totalRows > 100) {
      isMalicious = true;
      reason = "List message overload crash attack.";
    }
  }

  if (isMalicious) {
    if (logger) {
      logger.warn(`[Anti-Crash Sanitizer] Attack blocked from ${senderJid} in ${remoteJid}: ${reason}`);
    }

    // Tangani serangan
    handleSecurityThreat(sock, msg, senderJid, remoteJid, reason, logger);
    return true;
  }

  return false;
}

async function handleSecurityThreat(sock, msg, senderJid, remoteJid, reason, logger) {
  try {
    // 1. Hapus pesan berbahaya dari chat
    await sock.sendMessage(remoteJid, { delete: msg.key }).catch(() => {});

    // 2. Ban user secara permanen di database
    db.updateUser(senderJid, {
      banned: true,
      registered: false,
      role: "banned",
    });

    // 3. Jika terjadi di dalam grup, keluarkan pelaku
    if (remoteJid.endsWith("@g.us")) {
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const botJid = sock.user?.id ? db.normalizeJid(sock.user.id) : "";
        const botEntry = groupMeta?.participants?.find((p) => db.normalizeJid(p.id) === botJid);
        const isBotAdmin = botEntry?.admin === "admin" || botEntry?.admin === "superadmin";

        if (isBotAdmin) {
          await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove").catch(() => {});
        }
      } catch (_) {}

      await sock.sendMessage(
        remoteJid,
        {
          text:
            `🛡️ *[ANTI-CRASH & VIRTEX SHIELD]*\n\n` +
            `Serangan crash / payload mencurigakan berhasil dinetralkan!\n\n` +
            `• Pelaku: @${senderJid.split("@")[0]}\n` +
            `• Alasan: ${reason}\n` +
            `• Sanksi: Pesan dihapus, Akun di-Banned permanen, & Dikeluarkan dari grup.`,
          mentions: [senderJid],
        }
      ).catch(() => {});
    }
  } catch (err) {
    if (logger) {
      logger.error(`[Anti-Crash Error] Failed to execute sanctions: ${err.message}`);
    }
  }
}
