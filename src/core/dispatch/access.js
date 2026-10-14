import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { isGroupJid } from "./identity.js";

export async function resolveCommandAccess(
  sock,
  msg,
  { _botJidEarly, botJid, isFromMe, normalizedRawSender, _remoteNormalized, messageContent }
) {
  const activeSettings = db.getBotSettings(botJid);
  const prefix = activeSettings.prefix || ".";
  if (!messageContent.startsWith(prefix)) return { drop: true };

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return { drop: true };

  const cmd = commands.get(commandName);
  if (!cmd) return { drop: true };

  const remoteJid = msg.key.remoteJid;

  // Identitas pengirim:
  // - Pesan biasa: pakai participant/remoteJid yang sudah di-resolve.
  // - Pesan fromMe (dikirim akun bot sendiri): di DM, remoteJid adalah lawan bicara
  //   (manusia) sehingga itu identitas yang benar. Kalau tidak ada / sama dengan JID bot
  //   (mis. di grup atau DM ke diri sendiri), pengirim dianggap bot dan TIDAK punya hak owner.
  const isSelfMessage = Boolean(isFromMe);
  const senderIsBotItself = Boolean(isSelfMessage && botJid && db.sameUser(normalizedRawSender, botJid));
  const senderJid = isSelfMessage ? normalizedRawSender || botJid : normalizedRawSender;

  // Pesan yang benar-benar berasal dari akun bot sendiri (grup / DM ke diri sendiri)
  // tidak pernah diproses sebagai perintah: mencegah echo loop dan mencegah
  // JID bot yang kebetulan terdaftar sebagai owner ikut mendapat hak owner.
  if (senderIsBotItself) return { drop: true };

  // CATATAN KEAMANAN: fromMe tidak otomatis berstatus Owner.
  const isSenderOwner = db.isOwner(senderJid) || db.isBotOwner(botJid, senderJid);

  const access = db.getAccess(senderJid);
  const isOwner = Boolean(isSenderOwner || access.owner);
  const isAdmin = Boolean(isOwner || access.admin);
  const isPremium = Boolean(isOwner || isAdmin || access.premium);
  const isRegistered = Boolean(isOwner || isAdmin || isPremium);

  if (activeSettings.public === false && !isOwner) {
    return { drop: true };
  }

  if (activeSettings.maintenance === true && !isOwner) {
    if (activeSettings.silentDeny === false) {
      const mtext = String(activeSettings.maintenanceMessage || "🔧 Bot sedang maintenance. Coba lagi nanti.");
      await sock.sendMessage(remoteJid, { text: mtext }, { quoted: msg }).catch(() => {});
    }
    return { drop: true };
  }

  if (!isRegistered && !isGroupJid(remoteJid)) {
    const allowed = Array.isArray(activeSettings.publicCommands)
      ? activeSettings.publicCommands.map((c) => String(c || "").toLowerCase())
      : [];
    const invoked = new Set(
      [commandName, cmd.name?.toLowerCase(), ...(cmd.aliases || []).map((a) => String(a || "").toLowerCase())].filter(
        Boolean
      )
    );
    const isPublicCommand = [...invoked].some((n) => allowed.includes(n));
    if (!isPublicCommand) return { drop: true };
  }

  const user = access.user || {
    name: msg.pushName || "",
    owner: false,
    admin: false,
    premium: false,
    banned: false,
    role: "user",
  };

  return {
    activeSettings,
    prefix,
    args,
    commandName,
    cmd,
    senderJid,
    access,
    isOwner,
    isAdmin,
    isPremium,
    isRegistered,
    user,
  };
}
