import { db } from "@/src/core/database.js";
import { formatToWhatsAppJid, parsePhoneNumbers } from "@/src/utils/helper.js";

async function validateWhatsAppNumbers(sock, jids) {
  const valid = [];
  const invalid = [];

  for (const jid of jids) {
    const cleanJid = db.normalizeJid(jid);
    if (cleanJid.endsWith("@lid") || cleanJid.endsWith("@g.us") || db.data.users[cleanJid]) {
      valid.push(cleanJid);
      continue;
    }

    try {
      const check = await sock.onWhatsApp(cleanJid);
      if (check && check.length > 0 && check[0].exists) {
        valid.push(db.normalizeJid(check[0].jid || cleanJid));
      } else {
        if (cleanJid.includes("@s.whatsapp.net")) {
          valid.push(cleanJid);
        } else {
          invalid.push(cleanJid);
        }
      }
    } catch (_) {
      valid.push(cleanJid);
    }
  }

  return { valid, invalid };
}

export default {
  name: "user",
  description: "Manajemen pendaftaran, status, dan pemblokiran pengguna secara massal/satuan.",
  usage: "<ban/unban/register/unregister/check/list> <nomor1 nomor2... | tag>",
  example: "user ban 08123456789 08987654321 Spam bot",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `👥 *Manajemen Pengguna (Enterprise)*\n\n` +
                `│ .user ban <nomor/tag...> [alasan]\n` +
                `│ .user unban <nomor/tag...>\n` +
                `│ .user register <nomor/tag...>\n` +
                `│ .user unregister <nomor/tag...>\n` +
                `│ .user check <nomor/tag>\n` +
                `│ .user list\n\n` +
                `*Catatan:* Mendukung banyak nomor sekaligus via spasi/koma & auto-cek status WhatsApp.`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    // 1. STATISTIK PENGGUNA
    if (action === "list") {
      const allUsers = Object.keys(db.data.users);
      const registered = allUsers.filter((u) => db.data.users[u].registered).length;
      const banned = allUsers.filter((u) => db.data.users[u].banned).length;
      const premium = allUsers.filter((u) => db.data.users[u].premium).length;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `📊 *Direktori Pengguna Database*\n\n` +
                `• Total Terdaftar : *${registered}* pengguna\n` +
                `• Total Premium   : *${premium}* pengguna\n` +
                `• Total Diblokir  : *${banned}* pengguna\n` +
                `• Total Record DB : *${allUsers.length}* entitas`
        },
        { quoted: msg }
      );
      return;
    }

    // 2. AMBIL LIST TARGET NOMOR / MENTIONS
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    
    let rawTargets = [];
    if (mentionedJids.length > 0) {
      rawTargets.push(...mentionedJids.map((j) => db.normalizeJid(j)));
    }
    if (quotedParticipant) {
      rawTargets.push(db.normalizeJid(quotedParticipant));
    }

    const remainingArgs = args.slice(1);
    const parsedFromText = parsePhoneNumbers(remainingArgs);
    rawTargets.push(...parsedFromText);

    // Filter duplicates
    rawTargets = Array.from(new Set(rawTargets));

    if (rawTargets.length === 0) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Masukkan minimal satu nomor telepon valid atau tag pengguna target!" },
        { quoted: msg }
      );
      return;
    }

    // 3. CEK INFORMASI USER TUNGGAL
    if (action === "check" || action === "info") {
      const targetJid = rawTargets[0];
      const targetNum = targetJid.split("@")[0];
      const user = db.getUser(targetJid);
      const isPrivileged = db.isPrivilegedJid(targetJid);

      const checkWa = await sock.onWhatsApp(targetJid).catch(() => []);
      const existsOnWa = checkWa && checkWa.length > 0 && checkWa[0].exists;

      const report =
        `👤 *Detail Profil Pengguna*\n\n` +
        `• JID           : \`${targetJid}\`\n` +
        `• Nomor         : +${targetNum}\n` +
        `• WhatsApp Aktif: ${existsOnWa ? "✅ Terdaftar" : "❌ Tidak Terdaftar"}\n` +
        `• Nama Terdaftar: ${user.name || "-"}\n` +
        `• Terdaftar DB  : ${user.registered ? "✅ Ya" : "❌ Belum"}\n` +
        `• Status Akun   : ${user.banned ? "🚫 Diblokir (Banned)" : "🟢 Aktif"}\n` +
        `• Role Premium  : ${user.premium ? "⭐ Ya" : "❌ Tidak"}\n` +
        `• Akses Khusus  : ${isPrivileged ? "👑 Privileged / Owner" : "👤 Reguler"}\n` +
        `• Limit Kuota   : ${user.limit ?? 100}\n` +
        `• Bergabung     : ${user.joinedAt ? user.joinedAt.split("T")[0] : "-"}`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: report, mentions: [targetJid] },
        { quoted: msg }
      );
      return;
    }

    // 4. VALIDASI WHATSAPP UNTUK BATCH ACTION
    const { valid: validTargets, invalid: invalidTargets } = await validateWhatsAppNumbers(
      sock,
      rawTargets
    );

    const successList = [];
    const skippedPrivileged = [];

    for (const targetJid of validTargets) {
      const isPrivileged = db.isPrivilegedJid(targetJid);

      if (action === "ban") {
        if (isPrivileged) {
          skippedPrivileged.push(targetJid);
          continue;
        }
        db.updateUser(targetJid, { banned: true });
        successList.push(targetJid);
      } else if (action === "unban") {
        db.updateUser(targetJid, { banned: false });
        successList.push(targetJid);
      } else if (action === "register" || action === "reg") {
        db.updateUser(targetJid, { registered: true });
        successList.push(targetJid);
      } else if (action === "unregister" || action === "unreg") {
        if (isPrivileged) {
          skippedPrivileged.push(targetJid);
          continue;
        }
        db.updateUser(targetJid, { registered: false });
        successList.push(targetJid);
      }
    }

    // 5. LAPORAN HASIL BATCH
    let reportText = `📋 *Laporan Manajemen Pengguna (${action.charAt(0).toUpperCase() + action.slice(1)})*\n\n`;

    if (successList.length > 0) {
      reportText += `✅ *Berhasil Diproses (${successList.length}):*\n`;
      successList.forEach((j) => {
        reportText += `• @${j.split("@")[0]}\n`;
      });
      reportText += "\n";
    }

    if (skippedPrivileged.length > 0) {
      reportText += `⚠️ *Dilewati (Owner/Admin Bot) (${skippedPrivileged.length}):*\n`;
      skippedPrivileged.forEach((j) => {
        reportText += `• @${j.split("@")[0]}\n`;
      });
      reportText += "\n";
    }

    if (invalidTargets.length > 0) {
      reportText += `❌ *Nomor Tidak Aktif di WhatsApp (${invalidTargets.length}):*\n`;
      invalidTargets.forEach((j) => {
        reportText += `• ${j.split("@")[0]}\n`;
      });
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: reportText.trim(), mentions: [...successList, ...skippedPrivileged] },
      { quoted: msg }
    );
  },
};
