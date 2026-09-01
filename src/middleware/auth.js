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

  // Auto-check expired subscription
  if (userProfile?.tierExpiresAt && !isOwner) {
    const expireDate = new Date(userProfile.tierExpiresAt);
    if (Date.now() > expireDate.getTime()) {
      userProfile.tier = "free";
      userProfile.role = "user";
      userProfile.premium = false;
      userProfile.limited = false;
      userProfile.vvip = false;
      userProfile.tierExpiresAt = null;
      userProfile.premiumExpiresAt = null;
      db.save();
    }
  }

  const tier = isOwner
    ? "owner"
    : isBotAdmin
    ? "admin"
    : (userProfile?.tier || (userProfile?.premium ? "vip" : "free")).toLowerCase();

  const isVvip = Boolean(isOwner || tier === "vvip" || tier === "platinum" || userProfile?.vvip);
  const isVip = Boolean(isOwner || isVvip || tier === "vip" || tier === "premium" || userProfile?.premium);
  const isLimited = Boolean(isOwner || isVip || userProfile?.limited || userProfile?.role === "limited");
  const isPremium = Boolean(isOwner || isVip || isLimited);
  const isRegistered = Boolean(isOwner || userProfile?.registered);

  return {
    isSuperOwner,
    isBotAdmin,
    isOwner,
    isVvip,
    isVip,
    isLimited,
    isPremium,
    isRegistered,
    tier,
    userProfile,
  };
}

export function isPublicCommand(commandName) {
  return PUBLIC_COMMANDS.has(commandName.toLowerCase());
}
