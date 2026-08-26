import { extractMessageContent } from "baileys";
import { settings } from "@/config/settings.js";
import { db } from "@/src/core/database.js";
import { commands } from "@/src/core/loader.js";
import { handleStatusBroadcast } from "@/src/middleware/statusSaver.js";
import { processGroupSecurity } from "@/src/middleware/groupSecurity.js";
import { evaluatePermissions, isPublicCommand } from "@/src/middleware/auth.js";
import { checkBurst, checkCooldown, checkDuplicateMessage } from "@/src/middleware/antispam.js";

function getLevenshteinDistance(a, b) {
  const la = a.length;
  const lb = b.length;

  let prev = Array.from({ length: la + 1 }, (_, i) => i);
  for (let j = 1; j <= lb; j++) {
    const curr = [j];
    for (let i = 1; i <= la; i++) {
      curr[i] =
        b[j - 1] === a[i - 1]
          ? prev[i - 1]
          : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
    }
    prev = curr;
  }
  return prev[la];
}

export async function dispatchMessage(sock, msg, logger) {
  if (!msg.message || !msg.key?.id) return;

  // Anti-Duplikasi Pesan: Abaikan jika ID pesan ini sudah pernah diproses
  if (checkDuplicateMessage(msg.key.id)) {
    if (logger) {
      logger.debug(`[Anti-Duplicate] Skipped already processed message ID: ${msg.key.id}`);
    }
    return;
  }

  msg.message = extractMessageContent(msg.message);
  if (!msg.message) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  if (remoteJid === "status@broadcast") {
    handleStatusBroadcast(sock, msg, logger);
    return;
  }

  const senderJid = db.normalizeJid(msg.key.participant || remoteJid);
  const senderName = msg.pushName || "User";
  const { isOwner, isPremium, isLimited, userProfile } = evaluatePermissions(sock, msg, senderJid);

  if (userProfile.banned && !isOwner) return;
  if (db.data.settings.selfMode && !isOwner) return;

  let messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    msg.message.buttonsResponseMessage?.selectedButtonId ||
    msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.message.templateButtonReplyMessage?.selectedId ||
    msg.message.viewOnceMessage?.message?.imageMessage?.caption ||
    msg.message.viewOnceMessage?.message?.videoMessage?.caption ||
    msg.message.viewOnceMessageV2?.message?.imageMessage?.caption ||
    msg.message.viewOnceMessageV2?.message?.videoMessage?.caption ||
    "";

  if (!messageContent && msg.message.interactiveResponseMessage) {
    try {
      const nativeFlow = msg.message.interactiveResponseMessage.nativeFlowResponseMessage;
      const params = nativeFlow?.paramsJson ? JSON.parse(nativeFlow.paramsJson) : {};
      messageContent =
        params.id ||
        nativeFlow?.id ||
        msg.message.interactiveResponseMessage.body?.text ||
        "";
    } catch (_) {}
  }

  const groupIntercepted = await processGroupSecurity(
    sock,
    msg,
    messageContent,
    senderJid,
    remoteJid,
    isOwner,
    logger
  );
  if (groupIntercepted) return;

  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";
  messageContent = messageContent.trim();
  if (!messageContent.startsWith(activePrefix)) return;

  const args = messageContent.slice(activePrefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return;

  logger.debug(`[Cmd Dispatch] ${commandName} from ${senderJid}`);

  const cmd = commands.get(commandName);
  if (!cmd) {
    const allCmds = Array.from(commands.keys());
    let closest = null;
    let minDistance = Infinity;

    for (const name of allCmds) {
      let dist = getLevenshteinDistance(commandName, name);
      if (name.startsWith(commandName[0])) dist -= 0.6;
      if (name.includes(commandName)) dist -= 1.5;
      if (dist < minDistance) {
        minDistance = dist;
        closest = name;
      }
    }

    const threshold = Math.max(2, Math.floor(commandName.length * 0.5));
    if (closest && minDistance <= threshold) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ Perintah *${activePrefix}${commandName}* tidak ditemukan.\n\nMungkin maksud Anda: *${activePrefix}${closest}* ?`,
        },
        { quoted: msg }
      );
    }
    return;
  }

  const isRegistered = userProfile.registered || isOwner;
  const isPublic = isPublicCommand(commandName);

  if (!isRegistered && !isPublic) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ *Akses Ditolak*\n\nAnda belum terdaftar. Ketik: *${activePrefix}register*\n\n_${settings.botName}_`,
      },
      { quoted: msg }
    );
    return;
  }

  if (db.data.settings.maintenance && !isOwner) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ *Kyros-MD sedang dalam pemeliharaan (maintenance).*" },
      { quoted: msg }
    );
    return;
  }

  // Safeguard: Owner Only
  if (cmd.ownerOnly && !isOwner) {
    await sock.sendMessage(
      remoteJid,
      { text: "👑 *Khusus Owner:* Perintah ini hanya dapat dijalankan oleh Owner/Admin Bot." },
      { quoted: msg }
    );
    return;
  }

  // Safeguard: Limited Only
  if (cmd.limitedOnly && !isLimited && !isOwner) {
    await sock.sendMessage(
      remoteJid,
      { text: "🔒 *Khusus Limited Access:* Perintah ini memerlukan role *Limited* atau *Owner*." },
      { quoted: msg }
    );
    return;
  }

  // Safeguard: Premium Only
  if (cmd.premiumOnly && !isOwner && !isPremium) {
    await sock.sendMessage(
      remoteJid,
      { text: "👑 *Khusus Premium:* Perintah ini memerlukan status Premium." },
      { quoted: msg }
    );
    return;
  }

  // Safeguard: Group Only
  const isGroup = remoteJid.endsWith("@g.us");
  if (cmd.groupOnly && !isGroup) {
    await sock.sendMessage(
      remoteJid,
      { text: "👥 *Khusus Grup:* Perintah ini hanya dapat digunakan di dalam grup WhatsApp." },
      { quoted: msg }
    );
    return;
  }

  // Safeguard: Private Chat Only
  if (cmd.privateOnly && isGroup) {
    await sock.sendMessage(
      remoteJid,
      { text: "👤 *Khusus Private Chat:* Perintah ini hanya dapat digunakan di chat pribadi bot." },
      { quoted: msg }
    );
    return;
  }

  if (!isOwner) {
    const burstRemaining = checkBurst(senderJid);
    if (burstRemaining > 0) {
      const secs = (burstRemaining / 1000).toFixed(0);
      await sock.sendMessage(
        remoteJid,
        { text: `🚫 *Anti-Spam:* Terlalu banyak perintah sekaligus. Tunggu *${secs}s* dulu.` },
        { quoted: msg }
      );
      return;
    }

    const isMarketing =
      cmd.category?.toLowerCase() === "marketing" ||
      ["jpm", "bcgc", "jpmch", "pushkontak"].includes(cmd.name);

    if (cmd.cooldown || isMarketing) {
      let duration = cmd.cooldown || settings.cooldownTime || 3000;
      if (isPremium) {
        duration = Math.max(1000, Math.floor(duration / 2));
      }
      const cooldownRemaining = checkCooldown(senderJid, duration);
      if (cooldownRemaining > 0) {
        const secs = (cooldownRemaining / 1000).toFixed(1);
        await sock.sendMessage(
          remoteJid,
          { text: `⏳ *Anti-Spam:* Harap tunggu *${secs}s*.` },
          { quoted: msg }
        );
        return;
      }
    }
  }

  logger.info(`[Command] ${cmd.name} by ${senderName} (${senderJid})`);

  const context = {
    logger,
    senderName,
    senderJid,
    isOwner,
    isPremium,
    isLimited,
    isGroup,
    userProfile,
    activePrefix,
    commandName,
    getTargetJid: (args) => {
      const mentioned =
        msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentioned?.length > 0) return db.normalizeJid(mentioned[0]);
      const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
      if (quoted) return db.normalizeJid(quoted);
      if (args?.[0]) {
        const cleaned = args[0].replace(/[^0-9]/g, "");
        if (cleaned.length >= 7) return cleaned + "@s.whatsapp.net";
      }
      return null;
    },
    sendTyping: async () => {
      sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});
    },
    sendUsage: async () => {
      const descText = cmd.description
        ? `📝 *Deskripsi:* ${cmd.description}\n\n`
        : "";
      const usageText = cmd.usage
        ? `👉 *Format:*  \`${activePrefix}${commandName} ${cmd.usage}\`\n`
        : "";
      const exampleText = cmd.example
        ? `👉 *Contoh:* \`${activePrefix}${commandName} ${cmd.example}\``
        : "";
      await sock.sendMessage(
        remoteJid,
        {
          text: (
            `⚠️ *Cara Penggunaan ${activePrefix}${commandName}*\n\n` +
            descText +
            usageText +
            exampleText
          ).trim(),
        },
        { quoted: msg }
      );
    },
  };

  db.recordCommand(cmd.name);

  try {
    await cmd.run(sock, msg, args, context);
  } catch (err) {
    logger.error(`[Command Error] ${cmd.name}:`, err);
    try {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            `❌ *Terjadi kesalahan pada perintah ${cmd.name}:*\n\n` +
            `*Pesan:* ${err.message || err}\n\n` +
            `*Stack Trace:*\n\`\`\`\n${err.stack || "Tidak ada stack trace."}\n\`\`\``,
        },
        { quoted: msg }
      );
    } catch (_) {}
  }
}
