import { extractMessageContent, downloadMediaMessage } from "baileys";
import fs from "fs";
import path from "path";
import { settings } from "@/config/settings.js";
import { db } from "@/lib/database.js";
import { commands } from "@/lib/plugins.js";
import { getCachedGroupMeta, sleep } from "@/lib/utils.js";
import handleCase, { hasCommand } from "../case.js";

const cooldowns = new Map();
const burstGuard = new Map();
const BURST_LIMIT = 5;
const BURST_WINDOW = 10_000;
const BURST_BLOCK_MS = 60_000;

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

const ACTIVE_PREFIX = settings.prefix || ".";

const statusesDir = path.join(process.cwd(), "statuses");

async function handleStatusBroadcast(sock, msg) {
  const keys = Object.keys(msg.message);
  const hasMedia =
    keys.includes("imageMessage") || keys.includes("videoMessage");
  if (!hasMedia) return;

  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: {
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
          }),
        },
        reuploadRequest: sock.updateMediaMessage,
      },
    );

    if (!fs.existsSync(statusesDir))
      fs.mkdirSync(statusesDir, { recursive: true });

    const participant = msg.key.participant
      ? msg.key.participant.split("@")[0]
      : "unknown";
    const extension = keys.includes("imageMessage") ? "jpg" : "mp4";
    const filename = `status_${participant}_${Date.now()}.${extension}`;

    fs.writeFileSync(path.join(statusesDir, filename), buffer);
    console.log(
      `[Status Saver] Saved status from ${participant} as ${filename}`,
    );
  } catch (err) {
    console.error("[Status Saver Error]", err);
  }
}

function checkBurst(jid) {
  const now = Date.now();
  let rec = burstGuard.get(jid);

  if (!rec) {
    rec = { count: 0, windowStart: now, blockedUntil: 0 };
  }

  if (rec.blockedUntil > now) {
    return rec.blockedUntil - now;
  }

  if (now - rec.windowStart > BURST_WINDOW) {
    rec.count = 0;
    rec.windowStart = now;
  }

  rec.count++;

  if (rec.count > BURST_LIMIT) {
    rec.blockedUntil = now + BURST_BLOCK_MS;
    rec.count = 0;
    burstGuard.set(jid, rec);
    return BURST_BLOCK_MS;
  }

  burstGuard.set(jid, rec);
  return 0;
}

export async function handleMessage(sock, msg, logger) {
  if (!msg.message) return;

  msg.message = extractMessageContent(msg.message);
  if (!msg.message) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  if (remoteJid === "status@broadcast") {
    await handleStatusBroadcast(sock, msg);
    return;
  }

  const senderJid = db.normalizeJid(msg.key.participant || remoteJid);
  const senderName = msg.pushName || "User";
  const botJid = sock.user?.id ? db.normalizeJid(sock.user.id) : "";

  const normalizedOwner = db.normalizeJid(settings.ownerNumber);
  const normalizedPairing = db.normalizeJid(settings.pairingNumber);

  const isBotAdmin = (db.data.settings.admins || []).some(
    (a) => db.normalizeJid(a) === senderJid,
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

  if (userProfile.banned && !isOwner) return;
  if (db.data.settings.selfMode && !isOwner) return;

  let messageContent =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.buttonsResponseMessage?.selectedButtonId ||
    msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.message.templateButtonReplyMessage?.selectedId ||
    "";

  if (!messageContent && msg.message.interactiveResponseMessage) {
    try {
      const params = JSON.parse(
        msg.message.interactiveResponseMessage.nativeFlowResponseMessage
          .paramsJson,
      );
      messageContent =
        params.id ||
        msg.message.interactiveResponseMessage.nativeFlowResponseMessage.id ||
        "";
    } catch (_) {}
  }

  if (remoteJid.endsWith("@g.us") && !isOwner && !msg.key.fromMe) {
    const groupConfig = db.getGroup(remoteJid);

    if (groupConfig && (groupConfig.antilink || groupConfig.antibot)) {
      const groupMeta = await getCachedGroupMeta(sock, remoteJid);
      const participants = groupMeta?.participants || [];
      const senderEntry = participants.find(
        (p) => db.normalizeJid(p.id) === senderJid,
      );
      const isSenderAdmin =
        senderEntry?.admin === "admin" || senderEntry?.admin === "superadmin";

      if (groupConfig.antilink) {
        const hasLink =
          /https?:\/\/\S+/i.test(messageContent) ||
          /chat\.whatsapp\.com/i.test(messageContent);
        if (hasLink && !isSenderAdmin) {
          logger.debug(
            `[Anti-Link] Deleting link message from ${senderJid} in ${remoteJid}`,
          );
          await sock.sendMessage(remoteJid, { delete: msg.key });

          const warnings = groupConfig.warnings || {};
          const warnCount = (warnings[senderJid] || 0) + 1;
          warnings[senderJid] = warnCount;
          db.updateGroup(remoteJid, { warnings });

          if (warnCount >= 3) {
            delete warnings[senderJid];
            db.updateGroup(remoteJid, { warnings });
            await sock.groupParticipantsUpdate(
              remoteJid,
              [senderJid],
              "remove",
            );
            await sock.sendMessage(remoteJid, {
              text: `🚫 *[KICKED - ANTILINK]*\n\n@${senderJid.split("@")[0]} telah dikeluarkan karena mengabaikan peringatan antilink (3/3).`,
              mentions: [senderJid],
            });
          } else {
            await sock.sendMessage(remoteJid, {
              text: `⚠️ *[PERINGATAN ANTILINK]*\n\n@${senderJid.split("@")[0]}, dilarang keras membagikan link di grup ini!\n\n• Peringatan: *${warnCount}/3*\n• Sanksi: Jika melanggar lagi sampai 3 kali, Anda akan dikeluarkan otomatis.`,
              mentions: [senderJid],
            });
          }
          return;
        }
      }

      if (groupConfig.antibot) {
        const isBotMsg =
          msg.key.id.startsWith("BAE5") ||
          msg.key.id.startsWith("3EB0") ||
          (msg.key.id.startsWith("WA") && msg.key.id.length === 12);
        if (isBotMsg && !isSenderAdmin) {
          logger.debug(
            `[Antibot] Removing bot sender ${senderJid} in ${remoteJid}`,
          );
          await sock.sendMessage(remoteJid, { delete: msg.key });
          await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
          await sock.sendMessage(remoteJid, {
            text: `🛡️ *[ANTIBOT ACTION]*\n\nBot lain terdeteksi mengirimkan pesan di grup ini!\n\n• Target: @${senderJid.split("@")[0]}\n• Tindakan: Pesan dihapus & pelaku dikeluarkan otomatis.`,
            mentions: [senderJid],
          });
          return;
        }
      }
    }
  }

  const activePrefix = db.data?.settings?.prefix || settings.prefix || ".";

  if (!messageContent.startsWith(activePrefix)) return;

  const args = messageContent.slice(activePrefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase() || "";

  logger.debug(`[Cmd] ${commandName} from ${senderJid}`);

  if (!commandName) return;

  if (hasCommand(commandName)) {
    const isRegistered = userProfile.registered || isOwner;
    const isPublicCmd = PUBLIC_COMMANDS.has(commandName);

    if (!isRegistered && !isPublicCmd) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ *Akses Ditolak*\n\nAnda belum terdaftar. Ketik: *${ACTIVE_PREFIX}register*\n\n_${settings.botName}_`,
        },
        { quoted: msg },
      );
      return;
    }

    if (db.data.settings.maintenance && !isOwner) {
      await sock.sendMessage(
        remoteJid,
        {
          text: "⚠️ *Kyros-MD sedang dalam pemeliharaan (maintenance).*",
        },
        { quoted: msg },
      );
      return;
    }

    if (!isOwner) {
      const now = Date.now();
      const burstRemaining = checkBurst(senderJid);
      if (burstRemaining > 0) {
        const secs = (burstRemaining / 1000).toFixed(0);
        await sock.sendMessage(
          remoteJid,
          {
            text: `🚫 *Anti-Spam:* Terlalu banyak perintah sekaligus. Tunggu *${secs}s* dulu.`,
          },
          { quoted: msg },
        );
        return;
      }

      const lastUsed = cooldowns.get(senderJid) || 0;
      const cooldownTime = settings.cooldownTime || 3000;
      if (now - lastUsed < cooldownTime) {
        const timeLeft = ((cooldownTime - (now - lastUsed)) / 1000).toFixed(1);
        await sock.sendMessage(
          remoteJid,
          {
            text: `⏳ *Anti-Spam:* Harap tunggu *${timeLeft}s*.`,
          },
          { quoted: msg },
        );
        return;
      }
      cooldowns.set(senderJid, now);
    }

    logger.info(
      `[Case Command] ${commandName} by ${senderName} (${senderJid})`,
    );

    const context = {
      logger,
      senderName,
      senderJid,
      isOwner,
      userProfile,
      activePrefix: ACTIVE_PREFIX,
      commandName,
      getTargetJid: (args) => {
        const mentioned =
          msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentioned?.length > 0) return db.normalizeJid(mentioned[0]);
        const quoted =
          msg.message.extendedTextMessage?.contextInfo?.participant;
        if (quoted) return db.normalizeJid(quoted);
        if (args?.[0]) {
          const cleaned = args[0].replace(/[^0-9]/g, "");
          if (cleaned.length >= 7) return cleaned + "@s.whatsapp.net";
        }
        return null;
      },
      getTargetNumber: (args) => {
        const jid = context.getTargetJid(args);
        return jid ? jid.split("@")[0] : null;
      },
      sendTyping: async () => {
        try {
          await sock.sendPresenceUpdate("composing", remoteJid);
        } catch (_) {}
      },
      sendUsage: async () => {
        await sock.sendMessage(
          remoteJid,
          {
            text: `⚠️ *Cara Penggunaan ${ACTIVE_PREFIX}${commandName}*`,
          },
          { quoted: msg },
        );
      },
    };

    db.recordCommand(commandName);

    try {
      const handled = await handleCase(sock, msg, commandName, args, context);
      if (handled) return;
    } catch (err) {
      logger.error(`[Case Command Error] ${commandName}:`, err);
      try {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              `❌ *Terjadi kesalahan pada perintah ${commandName}:*\n\n` +
              `*Pesan:* ${err.message || err}\n\n` +
              `*Stack Trace:*\n\`\`\`\n${err.stack || "Tidak ada stack trace."}\n\`\`\``,
          },
          { quoted: msg },
        );
      } catch (_) {}
      return;
    }
  }

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
          text: `⚠️ Perintah *${ACTIVE_PREFIX}${commandName}* tidak ditemukan.\n\nMungkin maksud Anda: *${ACTIVE_PREFIX}${closest}* ?`,
        },
        { quoted: msg },
      );
    }
    return;
  }

  const isRegistered = userProfile.registered || isOwner;
  const isPublicCmd = PUBLIC_COMMANDS.has(commandName);

  if (!isRegistered && !isPublicCmd) {
    await sock.sendMessage(
      remoteJid,
      {
        text: `⚠️ *Akses Ditolak*\n\nAnda belum terdaftar. Ketik: *${ACTIVE_PREFIX}register*\n\n_${settings.botName}_`,
      },
      { quoted: msg },
    );
    return;
  }

  if (db.data.settings.maintenance && !isOwner) {
    await sock.sendMessage(
      remoteJid,
      {
        text: "⚠️ *Kyros-MD sedang dalam pemeliharaan (maintenance).*",
      },
      { quoted: msg },
    );
    return;
  }

  if (cmd.ownerOnly && !isOwner) return;

  if (cmd.premiumOnly && !isOwner && !userProfile.premium) {
    await sock.sendMessage(
      remoteJid,
      {
        text: "👑 *Khusus Premium:* Perintah ini memerlukan status Premium.",
      },
      { quoted: msg },
    );
    return;
  }

  if (!isOwner) {
    const now = Date.now();

    const burstRemaining = checkBurst(senderJid);
    if (burstRemaining > 0) {
      const secs = (burstRemaining / 1000).toFixed(0);
      await sock.sendMessage(
        remoteJid,
        {
          text: `🚫 *Anti-Spam:* Terlalu banyak perintah sekaligus. Tunggu *${secs}s* dulu.`,
        },
        { quoted: msg },
      );
      return;
    }

    const isMarketing =
      cmd.category?.toLowerCase() === "marketing" ||
      ["jpm", "bcgc", "jpmch", "pushkontak"].includes(cmd.name);
    if (cmd.cooldown || isMarketing) {
      let cooldownTime = cmd.cooldown || settings.cooldownTime || 3000;
      if (userProfile.premium) {
        cooldownTime = Math.max(1000, Math.floor(cooldownTime / 2));
      }

      const lastUsed = cooldowns.get(senderJid) || 0;
      if (now - lastUsed < cooldownTime) {
        const timeLeft = ((cooldownTime - (now - lastUsed)) / 1000).toFixed(1);
        await sock.sendMessage(
          remoteJid,
          {
            text: `⏳ *Anti-Spam:* Harap tunggu *${timeLeft}s*.`,
          },
          { quoted: msg },
        );
        return;
      }
      cooldowns.set(senderJid, now);
    }
  }

  logger.info(`[Command] ${cmd.name} by ${senderName} (${senderJid})`);

  const context = {
    logger,
    senderName,
    senderJid,
    isOwner,
    userProfile,
    activePrefix: ACTIVE_PREFIX,
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
      try {
        await sock.sendPresenceUpdate("composing", remoteJid);
      } catch (_) {}
    },
    sendUsage: async () => {
      const descText = cmd.description
        ? `📝 *Deskripsi:* ${cmd.description}\n\n`
        : "";
      const usageText = cmd.usage
        ? `👉 *Format:*  \`${ACTIVE_PREFIX}${commandName} ${cmd.usage}\`\n`
        : "";
      const exampleText = cmd.example
        ? `👉 *Contoh:* \`${ACTIVE_PREFIX}${commandName} ${cmd.example}\``
        : "";
      await sock.sendMessage(
        remoteJid,
        {
          text: (
            `⚠️ *Cara Penggunaan ${ACTIVE_PREFIX}${commandName}*\n\n` +
            descText +
            usageText +
            exampleText
          ).trim(),
        },
        { quoted: msg },
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
        { quoted: msg },
      );
    } catch (_) {}
  }
}
