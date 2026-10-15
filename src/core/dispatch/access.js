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

/**
 * Perintah whitelisted (mis. menu/help/ping) tetap boleh dipakai walaupun bot
 * sedang private. Tanpa ini, `publicCommands` jadi kode mati karena semua
 * non-owner sudah ditolak lebih dulu oleh gate `public === false`.
 */
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
  { _botJidEarly, botJid, isFromMe, normalizedRawSender, _remoteNormalized, messageContent, logger }
) {
  const activeSettings = db.getBotSettings(botJid);
  const prefix = activeSettings.prefix || ".";
  const remoteJid = msg.key.remoteJid;

  // Setiap drop diberi alasan supaya bisa dilacak dari `pm2 logs` — dulu semua
  // penolakan diam-diam sehingga tidak bisa dibedakan dari bot yang offline.
  // `silent=true` untuk trafik normal yang memang bukan perintah / echo bot
  // sendiri (volumenya besar, tidak perlu memenuhi log).
  let commandName = "";
  const drop = (reason, { silent = false } = {}) => {
    if (!silent) logger?.info?.(`[Access] drop: ${reason} | prefix=${prefix} bot=${botJid || "?"}`);
    return { drop: true, reason, commandName, silent };
  };

  if (!messageContent.startsWith(prefix)) return drop("bukan perintah (prefix tidak cocok)", { silent: true });

  const args = messageContent.slice(prefix.length).trim().split(/ +/).filter(Boolean);
  commandName = args.shift()?.toLowerCase() || "";
  if (!commandName) return drop("perintah kosong", { silent: true });

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
    return drop(`perintah tidak dikenal: ${commandName}`);
  }

  // Identitas pengirim:
  // - Pesan biasa: pakai participant/remoteJid yang sudah di-resolve.
  // - Pesan fromMe (dikirim akun bot sendiri): di DM, remoteJid adalah lawan bicara
  //   (manusia) sehingga itu identitas yang benar. Kalau tidak ada / sama dengan JID bot
  //   (mis. di grup atau DM ke diri sendiri), pengirim dianggap bot dan TIDAK punya hak owner.
  const isSelfMessage = Boolean(isFromMe);
  const senderIsBotItself = Boolean(isSelfMessage && botJid && db.sameUser(normalizedRawSender, botJid));
  const senderJid = isSelfMessage ? normalizedRawSender || botJid : normalizedRawSender;

  // Nomor bot pada pairing ini = nomor owner, jadi pesan owner sendiri ikut
  // berflag fromMe. Buang HANYA echo (balasan bot sendiri yang dipantulkan
  // kembali); perintah yang diketik manual oleh pemilik akun bot tetap jalan.
  if (senderIsBotItself && isBotEchoMessage({ id: msg.key?.id, text: messageContent })) {
    return drop("echo balasan bot sendiri", { silent: true });
  }

  // CATATAN KEAMANAN: fromMe tidak otomatis berstatus Owner.
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

  if (!isRegistered && !isWhitelisted && !isGroupJid(remoteJid)) {
    return drop("pengirim belum terdaftar (DM, bukan whitelist)");
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
