import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";

const PUBLIC_COMMANDS = new Set([
  "register",
  "daftar",
  "help",
  "menu",
  "ping",
  "donate",
  "donasi",
  "sawer",
  "rules",
  "owner",
  "developer",
]);

export function evaluatePermissions(sock, msg, senderJid) {
  const botJid = sock.user?.id ? db.normalizeJid(sock.user.id) : "";
  const normalizedOwner = db.normalizeJid(settings.ownerNumber);
  const normalizedPairing = db.normalizeJid(settings.pairingNumber);

  const isSuperOwner = Boolean(
    msg.key.fromMe ||
    (normalizedOwner && senderJid.split("@")[0] === normalizedOwner.split("@")[0]) ||
    (normalizedPairing && senderJid.split("@")[0] === normalizedPairing.split("@")[0]) ||
    (botJid && senderJid.split("@")[0] === botJid.split("@")[0])
  );

  const userProfile = db.getUser(senderJid);
  const isBotAdmin = Boolean(userProfile?.admin || userProfile?.role === "admin");
  const isOwner = Boolean(isSuperOwner || isBotAdmin || userProfile?.owner);
  const isLimited = Boolean(isSuperOwner || isBotAdmin || userProfile?.limited || userProfile?.role === "limited");
  const isPremium = Boolean(isSuperOwner || isBotAdmin || isLimited || userProfile?.premium || userProfile?.role === "premium");
  const isRegistered = Boolean(isSuperOwner || isBotAdmin || userProfile?.registered);

  return {
    isSuperOwner,
    isBotAdmin,
    isOwner,
    isLimited,
    isPremium,
    isRegistered,
    userProfile,
  };
}

export function isPublicCommand(commandName) {
  return PUBLIC_COMMANDS.has(commandName.toLowerCase());
}
