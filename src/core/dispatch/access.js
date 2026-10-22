import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";
import { isGroupJid } from "./identity.js";
import { isBotEchoMessage } from "./echo.js";

function collectInvokedNames(commandName, cmd) {
  const names = new Set();
  const push = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (normalized) names.add(normalized);
  };
  push(commandName);
  push(cmd?.name);
  for (const alias of cmd?.aliases || []) push(alias);
  return names;
}

function isWhitelistedCommand(commandName, cmd, activeSettings) {
  const allowed = new Set(
    (Array.isArray(activeSettings?.publicCommands) ? activeSettings.publicCommands : []).map((c) =>
      String(c || "")
        .trim()
        .toLowerCase()
    )
  );
  if (allowed.size === 0) return false;
  return [...collectInvokedNames(commandName, cmd)].some((name) => allowed.has(name));
}

export async function resolveCommandAccess(
  sock,
  msg,
  { botJid, isFromMe, normalizedRawSender, messageContent, logger }
) {
  const activeSettings = db.getBotSettings(botJid);
  const prefix = activeSettings.prefix || ".";
  const remoteJid = msg.key.remoteJid;

  let commandName = "";
  const drop = (reason, { silent = false, code = "" } = {}) => {
    if (!silent) logger?.info?.(`[Access] drop: ${reason} | prefix=${prefix} bot=${botJid || "?"}`);
    return { drop: true, reason, commandName, silent, code };
  };

  if (!messageContent.startsWith(prefix)) {
    return drop("bukan perintah (prefix tidak cocok)", { silent: true, code: "not_command" });
  }

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return drop("perintah kosong", { silent: true, code: "not_command" });

  const cmd = commands.get(commandName);
  if (!cmd) {
    if (activeSettings.silentDeny === false) {
      await sock
        .sendMessage(
          remoteJid,
          { text: `⚠️ Perintah *${commandName}* tidak dikenal.\nKetik ${prefix}menu untuk daftar perintah.` },
          { quoted: msg }
        )
        .catch(() => {});
    }
    return drop(`perintah tidak dikenal: ${commandName}`, { code: "unknown_command" });
  }

  const isSelfMessage = Boolean(isFromMe);
  const senderJid = isSelfMessage
    ? isGroupJid(remoteJid)
      ? normalizedRawSender || botJid
      : botJid || normalizedRawSender
    : normalizedRawSender;

  if (isSelfMessage && isBotEchoMessage({ id: msg.key?.id, text: messageContent })) {
    return drop("echo balasan bot sendiri", { silent: true });
  }

  const isSenderOwner = db.isOwner(senderJid) || db.isBotOwner(botJid, senderJid);

  const access = db.getAccess(senderJid);
  const isOwner = Boolean(isSenderOwner || access.owner);
  const isAdmin = Boolean(isOwner || access.admin);
  const isPremium = Boolean(isOwner || isAdmin || access.premium);
  const isRegistered = Boolean(isOwner || isAdmin || isPremium);

  const isWhitelisted = isWhitelistedCommand(commandName, cmd, activeSettings);

  if (activeSettings.public === false && !isOwner && !isWhitelisted) {
    if (activeSettings.silentDeny === false) {
      await sock
        .sendMessage(
          remoteJid,
          { text: "🔒 Bot sedang dalam mode private. Perintah ini hanya untuk Owner/Admin/Premium." },
          { quoted: msg }
        )
        .catch(() => {});
    }
    return drop(`mode private, ${commandName} bukan whitelist`);
  }

  if (activeSettings.maintenance === true && !isOwner) {
    if (activeSettings.silentDeny === false) {
      const mtext = String(activeSettings.maintenanceMessage || "🔧 Bot sedang maintenance. Coba lagi nanti.");
      await sock.sendMessage(remoteJid, { text: mtext }, { quoted: msg }).catch(() => {});
    }
    return drop("mode maintenance");
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
