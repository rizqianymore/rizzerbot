import { extractMessageContent } from "baileys";
import { settings } from "@/config/settings.js";
import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";

export async function dispatchMessage(sock, msg, logger) {
  if (!msg.message || !msg.key?.id) return;

  msg.message = extractMessageContent(msg.message);
  if (!msg.message) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === "status@broadcast") return;

  let messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    "";

  const prefix = db.data.settings.prefix || settings.prefix || ".";
  if (!messageContent.startsWith(prefix)) return;

  const args = messageContent.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return;

  const cmd = commands.get(commandName);
  if (!cmd) return;

  const senderJid = db.normalizeJid(msg.key.participant || remoteJid);
  const isOwner = [settings.ownerNumber, settings.pairingNumber]
    .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    .includes(senderJid);

  const isPublic = db.data.settings.public !== false;
  if (!isPublic && !isOwner) return;

  const user = db.getUser(senderJid);
  const isPremium = isOwner || user.premium;

  if (cmd.ownerOnly && !isOwner) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk Owner!" }, { quoted: msg });
  }

  if (cmd.premiumOnly && !isPremium) {
    return sock.sendMessage(remoteJid, { text: "❌ Fitur ini hanya untuk pengguna Premium!" }, { quoted: msg });
  }

  logger.info(`[Command] ${cmd.name} from ${msg.pushName || "User"} (${senderJid})`);
  db.recordCommand(cmd.name);

  const responseDelay = settings.responseDelay || 0;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const context = {
    logger,
    prefix,
    commandName,
    isOwner,
    isPremium,
    senderJid,
    user,
    msg,
    quoted: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
    sendTyping: async () => {
      sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});
    },
    reply: async (text) => {
      if (responseDelay > 0) {
        sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});
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

      const mentioned =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentioned && mentioned.length > 0) {
        return db.normalizeJid(mentioned[0]);
      }

      const combined = Array.isArray(targetArgs)
        ? targetArgs.join(" ")
        : String(targetArgs || "");
      const match = combined.match(/(?:62|\+62|08|8)[0-9\s-]{6,16}/g);
      if (match && match.length > 0) {
        let num = match[0].replace(/[^0-9]/g, "");
        if (num.startsWith("08")) num = "628" + num.slice(2);
        else if (num.startsWith("8")) num = "62" + num;
        if (num.length >= 7) return num + "@s.whatsapp.net";
      }
      return null;
    },
  };

  try {
    await cmd.run(sock, msg, args, context);
  } catch (err) {
    logger.error(`[Command Error] ${cmd.name}:`, err);
    context.reply(`❌ Error: ${err.message}`);
  }
}
