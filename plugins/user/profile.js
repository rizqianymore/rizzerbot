import { db } from "@/src/core/database.js";

export default {
  name: "profile",
  aliases: ["me", "cekplan", "status"],
  description: "Melihat profil status akun, tier langganan, dan sisa masa aktif.",
  usage: "",
  category: "User",
  run: async (sock, msg, args, { sendTyping, senderJid, senderName, activePrefix, getTargetJid }) => {
    await sendTyping();

    const targetJid = getTargetJid(args) || senderJid;
    const profile = db.getUser(targetJid);
    const isOwner = db.isPrivilegedJid(targetJid);
    const targetName = targetJid === senderJid ? (senderName || profile.name || "User") : (profile.name || "User");

    let tierLabel = "FREE USER";
    let tierEmoji = "👤";

    if (isOwner) {
      tierLabel = "OWNER / DEVELOPER";
      tierEmoji = "👑";
    } else if (profile.vvip || profile.tier === "vvip") {
      tierLabel = "VVIP / PLATINUM";
      tierEmoji = "💎";
    } else if (profile.premium || profile.tier === "vip") {
      tierLabel = "VIP / PREMIUM";
      tierEmoji = "⭐";
    }

    let expireInfo = "Permanen / Bebas Kuota";
    if (!isOwner && profile.tierExpiresAt) {
      const expDate = new Date(profile.tierExpiresAt);
      const diffMs = expDate.getTime() - Date.now();
      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        expireInfo = `${expDate.toLocaleDateString("id-ID")} (${days}h ${hours}j lagi)`;
      } else {
        expireInfo = "Kedaluwarsa";
      }
    }

    const text =
      `╭─── . ݁₊ ⊹ *PROFIL PENGGUNA* ⊹ ₊ ݁.\n` +
      `│ 👤 *Nama:* ${targetName}\n` +
      `│ 📱 *Nomor:* @${targetJid.split("@")[0]}\n` +
      `│ ${tierEmoji} *Tier Plan:* ${tierLabel}\n` +
      `│ ⏳ *Masa Aktif:* ${expireInfo}\n` +
      `│ 🛡️ *Terdaftar:* ${profile.registered ? "✅ Ya" : "❌ Belum"}\n` +
      `╰──────────────\n\n` +
      `💡 *Info Tier:*\n` +
      `• *Free:* Basic Commands & Qwen 80B AI\n` +
      `• *VIP / Premium:* Media Downloader, OSINT, & DDG Multi-Model AI\n` +
      `• *VVIP / Platinum:* Full Priority, Google Gemini Web & Ultra AI Engine`;

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: text.trim(), mentions: [targetJid] },
      { quoted: msg }
    );
  },
};
