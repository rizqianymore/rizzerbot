import { db } from "@/src/core/database.js";
import { parsePhoneNumbers } from "@/src/utils/helper.js";

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([dhmwy])$/i);
  if (!match) {
    if (str.toLowerCase() === "perm" || str.toLowerCase() === "permanent") return "permanent";
    const days = parseInt(str, 10);
    if (!isNaN(days) && days > 0) return days * 24 * 60 * 60 * 1000;
    return null;
  }

  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    case "w": return num * 7 * 24 * 60 * 60 * 1000;
    case "y": return num * 365 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export default {
  name: "plan",
  aliases: ["setplan", "tier", "subscription"],
  description: "Manajemen Planning / Tier Berlangganan pengguna (Free, VIP, VVIP).",
  usage: "<add/del/list/check> <nomor/tag> [tier] [durasi]",
  example: "plan add 08123456789 vvip 30d",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const action = args[0]?.toLowerCase();

    if (!action) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `💎 *Manajemen Planning Tier Pelanggan (Enterprise)*\n\n` +
            `*Format Penggunaan:*\n` +
            `│ \`${activePrefix}plan add <nomor/tag> <vip|vvip> [durasi]\`\n` +
            `│ \`${activePrefix}plan del <nomor/tag>\`\n` +
            `│ \`${activePrefix}plan list\`\n` +
            `│ \`${activePrefix}plan check <nomor/tag>\`\n\n` +
            `*Tier Tersedia:*\n` +
            `• *VIP / Premium* (Downloader, OSINT, Gemini, DDG)\n` +
            `• *VVIP / Platinum* (Semua fitur VIP + Full Grok Web AI)\n\n` +
            `*Contoh:* \`${activePrefix}plan add 08123456789 vvip 30d\``,
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    // 1. LIST SEMUA PLAN
    if (action === "list") {
      const allUsers = Object.keys(db.data.users);
      const activePlans = allUsers.filter(
        (u) => db.data.users[u].tier === "vip" || db.data.users[u].tier === "vvip" || db.data.users[u].premium
      );

      if (activePlans.length === 0) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { text: "📋 Belum ada pengguna langganan VIP / VVIP aktif." },
          { quoted: msg }
        );
      }

      let textList = `💎 *DAFTAR PENGGUNA BERLANGGANAN (${activePlans.length})*\n\n`;
      activePlans.forEach((jid, i) => {
        const u = db.data.users[jid];
        const tierBadge = (u.tier || (u.premium ? "vip" : "free")).toUpperCase();
        const expInfo = u.tierExpiresAt
          ? `Exp: ${new Date(u.tierExpiresAt).toLocaleDateString("id-ID")}`
          : "Permanen";
        textList += `${i + 1}. @${jid.split("@")[0]} [${tierBadge}] (${expInfo})\n`;
      });

      return await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions: activePlans },
        { quoted: msg }
      );
    }

    // 2. CHECK STATUS PLAN
    if (action === "check" || action === "cek") {
      const targetPhone = parsePhoneNumbers(args.slice(1).join(" "))[0];
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetJid = targetPhone ? db.normalizeJid(targetPhone) : quotedJid;

      if (!targetJid) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Masukkan nomor atau balas pesan user yang ingin dicek!" },
          { quoted: msg }
        );
      }

      const profile = db.getUser(targetJid);
      const tierBadge = (profile.tier || (profile.premium ? "vip" : "free")).toUpperCase();
      const expDate = profile.tierExpiresAt
        ? new Date(profile.tierExpiresAt).toLocaleString("id-ID")
        : "Permanen / Tidak Terbatas";

      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `👤 *Informasi Plan Pengguna*\n\n` +
            `│ 📱 *Nomor:* @${targetJid.split("@")[0]}\n` +
            `│ 💎 *Tier:* ${tierBadge}\n` +
            `│ ⏳ *Masa Aktif:* ${expDate}\n` +
            `│ 🛡️ *Status:* ${profile.banned ? "BANNED" : "AKTIF"}\n` +
            `╰──────────────`,
          mentions: [targetJid],
        },
        { quoted: msg }
      );
    }

    // 3. TAMBAH / UPGRADE PLAN
    if (action === "add" || action === "set") {
      const phones = parsePhoneNumbers(args.slice(1).join(" "));
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedJid && !phones.includes(quotedJid.split("@")[0])) {
        phones.push(quotedJid.split("@")[0]);
      }

      if (phones.length === 0) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Masukkan minimal 1 nomor target!\nContoh: \`${activePrefix}plan add 08123456789 vvip 30d\`` },
          { quoted: msg }
        );
      }

      // Cari parameter tier
      let selectedTier = "vip";
      for (const arg of args.slice(1)) {
        const lower = arg.toLowerCase();
        if (lower === "vvip" || lower === "platinum") {
          selectedTier = "vvip";
          break;
        } else if (lower === "vip" || lower === "premium") {
          selectedTier = "vip";
          break;
        }
      }

      // Cari parameter durasi
      let durationMs = null;
      for (const arg of args.slice(1)) {
        const parsed = parseDuration(arg);
        if (parsed) {
          durationMs = parsed;
          break;
        }
      }

      let expiresAt = null;
      if (durationMs && durationMs !== "permanent") {
        expiresAt = new Date(Date.now() + durationMs).toISOString();
      }

      const updated = [];
      for (const p of phones) {
        const jid = db.normalizeJid(p);
        const user = db.getUser(jid);
        user.tier = selectedTier;
        user.role = selectedTier;
        user.premium = true;
        user.limited = true;
        user.vvip = selectedTier === "vvip";
        user.tierExpiresAt = expiresAt;
        user.premiumExpiresAt = expiresAt;
        user.limit = 999999;
        updated.push(jid);
      }

      db.save();

      const tierTitle = selectedTier === "vvip" ? "💎 VVIP / Platinum" : "⭐ VIP / Premium";
      const expText = expiresAt ? new Date(expiresAt).toLocaleDateString("id-ID") : "Permanen";

      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `✅ *Berhasil Mengatur Plan Pengguna*\n\n` +
            `│ 💎 *Tier Baru:* ${tierTitle}\n` +
            `│ ⏳ *Masa Berlaku:* ${expText}\n` +
            `│ 👥 *Total User:* ${updated.length}\n\n` +
            updated.map((j) => `• @${j.split("@")[0]}`).join("\n"),
          mentions: updated,
        },
        { quoted: msg }
      );
    }

    // 4. HAPUS / DOWNGRADE KE FREE
    if (action === "del" || action === "remove") {
      const phones = parsePhoneNumbers(args.slice(1).join(" "));
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedJid && !phones.includes(quotedJid.split("@")[0])) {
        phones.push(quotedJid.split("@")[0]);
      }

      if (phones.length === 0) {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Masukkan nomor yang ingin diturunkan ke Free!" },
          { quoted: msg }
        );
      }

      const deleted = [];
      for (const p of phones) {
        const jid = db.normalizeJid(p);
        const user = db.getUser(jid);
        user.tier = "free";
        user.role = "user";
        user.premium = false;
        user.limited = false;
        user.vvip = false;
        user.tierExpiresAt = null;
        user.premiumExpiresAt = null;
        user.limit = 100;
        deleted.push(jid);
      }

      db.save();

      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `✅ *Berhasil Menghapus Status Plan*\n\n` +
            `User telah diturunkan ke *Free User*:\n` +
            deleted.map((j) => `• @${j.split("@")[0]}`).join("\n"),
          mentions: deleted,
        },
        { quoted: msg }
      );
    }
  },
};
