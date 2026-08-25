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
]);

export function evaluatePermissions(sock, msg, senderJid) {
  const botJid = sock.user?.id ? db.normalizeJid(sock.user.id) : "";
  const normalizedOwner = db.normalizeJid(settings.ownerNumber);
  const normalizedPairing = db.normalizeJid(settings.pairingNumber);

  const isBotAdmin = (db.data.settings.admins || []).some(
    (a) => db.normalizeJid(a) === senderJid
  );

  const isOwner =
    msg.key.fromMe ||
    (normalizedOwner &&
      senderJid.split("@")[0] === normalizedOwner.split("@")[0]) ||
    (normalizedPairing &&
      senderJid.split("@")[0] === normalizedPairing.split("@")[0]) ||
    (botJid && senderJid.split("@")[0] === botJid.split("@")[0]) ||
    isBotAdmin;

  const userProfile = db.getUser(senderJid);

  return { isOwner, userProfile };
}

export function isPublicCommand(commandName) {
  return PUBLIC_COMMANDS.has(commandName.toLowerCase());
}
