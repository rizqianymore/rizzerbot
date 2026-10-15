import { isBurstMuted, registerBurst, userCooldowns } from "./guards.js";

const cmdCooldowns = new Map();

export async function checkPermits(cmd, { isOwner, isAdmin, isPremium }, deny) {
  if (cmd.ownerOnly && !isOwner) {
    await deny("❌ Fitur ini hanya untuk Owner!");
    return true;
  }

  if (cmd.adminOnly && !isAdmin) {
    await deny("❌ Fitur ini hanya untuk Admin Bot!");
    return true;
  }

  if (cmd.premiumOnly && !isPremium) {
    await deny("❌ Fitur ini hanya untuk pengguna Premium!");
    return true;
  }
  return false;
}

export async function checkRateLimit(activeSettings, senderJid, sock, msg, remoteJid, cmd) {
  const now = Date.now();
  if (activeSettings.antiBurst !== false) {
    const mutedUntil = isBurstMuted(senderJid);
    if (mutedUntil) {
      const sisa = Math.ceil((mutedUntil - Date.now()) / 1000);
      await sock.sendMessage(
        remoteJid,
        { text: `🚫 *Spam terdeteksi!* Tunggu ${sisa} detik sebelum perintah lagi.` },
        { quoted: msg }
      );
      return true;
    }
    const rec = registerBurst(senderJid);
    if (rec.mutedUntil && Date.now() < rec.mutedUntil) {
      await sock.sendMessage(remoteJid, { text: `🚫 *Spam burst terdeteksi!* Kamu dimute 60 detik.` }, { quoted: msg });
      return true;
    }
  }
  const perCmdMs = Number(cmd?.cooldownMs);
  if (Number.isFinite(perCmdMs) && perCmdMs > 0) {
    const key = `${senderJid}::${cmd.name}`;
    const lastCmd = cmdCooldowns.get(key) || 0;
    const diffCmd = now - lastCmd;
    if (diffCmd < perCmdMs) {
      const waitSec = ((perCmdMs - diffCmd) / 1000).toFixed(0);
      await sock.sendMessage(
        remoteJid,
        { text: `⏳ *Tunggu ${waitSec} detik* sebelum memakai *${cmd.name}* lagi!` },
        { quoted: msg }
      );
      return true;
    }
    cmdCooldowns.set(key, now);
    if (cmdCooldowns.size > 2000) {
      for (const [k, t] of cmdCooldowns.entries()) {
        if (now - t > perCmdMs * 2) cmdCooldowns.delete(k);
      }
    }
  }
  const configuredCooldown = Number(activeSettings.cooldownTime);
  const cooldownMs = Number.isFinite(configuredCooldown) && configuredCooldown >= 0 ? configuredCooldown : 3000;

  if (cooldownMs > 0) {
    const lastTime = userCooldowns.get(senderJid) || 0;
    const diff = now - lastTime;

    if (diff < cooldownMs) {
      const waitSec = ((cooldownMs - diff) / 1000).toFixed(1);
      await sock.sendMessage(
        remoteJid,
        { text: `⏳ *Mohon tunggu ${waitSec} detik* sebelum menggunakan perintah berikutnya!` },
        { quoted: msg }
      );
      return true;
    }
    userCooldowns.set(senderJid, now);
  }

  if (userCooldowns.size > 1000) {
    for (const [jid, time] of userCooldowns.entries()) {
      if (now - time > cooldownMs * 2) {
        userCooldowns.delete(jid);
      }
    }
  }
  return false;
}
