import { db } from "@/src/core/database.js";
import { getCachedGroupMeta } from "@/src/utils/helper.js";
import { isGroupJid, findParticipant, resolveBotJid, samePhoneJid, getPhoneDigits } from "./identity.js";

export async function getGroupAccessError(sock, remoteJid, senderJid, cmd, access) {
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
    botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  if (cmd.botAdminOnly && !isBotAdmin) {
    return "❌ Jadikan bot sebagai Admin grup terlebih dahulu!";
  }

  if (cmd.groupAdminOnly) {
    const userParticipant = findParticipant(meta, senderJid);
    const isGroupAdmin = Boolean(
      access.admin || (userParticipant && (userParticipant.admin === "admin" || userParticipant.admin === "superadmin"))
    );
    if (!isGroupAdmin) {
      return "❌ Fitur ini hanya untuk Admin Grup, Admin Bot, atau Owner Bot!";
    }
  }

  return null;
}

export async function resolveGroupResponder(sock, remoteJid, botJid, isSubBot) {
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
