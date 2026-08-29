import { db } from "@/src/core/database.js";
import { parsePhoneNumbers } from "@/src/utils/helper.js";

async function validateWhatsAppNumbers(sock, jids) {
  const valid = [];
  const invalid = [];

  for (const jid of jids) {
    try {
      const check = await sock.onWhatsApp(jid);
      if (check && check.length > 0 && check[0].exists) {
        valid.push(db.normalizeJid(check[0].jid || jid));
      } else {
        invalid.push(jid);
      }
    } catch (_) {
      valid.push(jid);
    }
  }

  return { valid, invalid };
}

export default {
  name: "admin",
  description: "Manajemen Admin Bot resmi secara massal atau satuan via nomor telepon.",
  usage: "<add/remove/list> <nomor1 nomor2... | tag>",
  example: "admin add 08123456789 08987654321",
  category: "Owner",
  superOwnerOnly: true,
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `👑 *Manajemen Admin Bot (Enterprise)*\n\n` +
            `│ ${activePrefix}admin add <nomor1 nomor2... | tag>\n` +
            `│ ${activePrefix}admin remove <nomor1 nomor2... | tag>\n` +
            `│ ${activePrefix}admin list\n\n` +
            `*Catatan:* Mendukung multi-nomor sekaligus & auto-validasi nomor WhatsApp.`,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (!db.data.settings.admins) {
      db.data.settings.admins = [];
    }

    // 1. LIST ADMIN
    if (action === "list") {
      const admins = db.data.settings.admins;
      if (admins.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "👑 Belum ada Admin Bot tambahan yang terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `👑 *DAFTAR ADMIN BOT RESMI (${admins.length})*\n\n`;
      admins.forEach((admin, i) => {
        textList += `${i + 1}. @${admin.split("@")[0]}\n`;
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions: admins },
        { quoted: msg }
      );
      return;
    }

    // 2. PARSE MULTI-TARGETS
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    let rawTargets = [];
    if (mentionedJids.length > 0) {
      rawTargets.push(...mentionedJids.map((j) => db.normalizeJid(j)));
    }
    if (quotedParticipant) {
      rawTargets.push(db.normalizeJid(quotedParticipant));
    }

    const parsedFromText = parsePhoneNumbers(args.slice(1));
    rawTargets.push(...parsedFromText);
    rawTargets = Array.from(new Set(rawTargets));

    if (rawTargets.length === 0) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Masukkan minimal satu nomor telepon valid atau tag target!" },
        { quoted: msg }
      );
      return;
    }

    // 3. AUTO-CHECK WHATSAPP NUMBERS
    const { valid: validTargets, invalid: invalidTargets } = await validateWhatsAppNumbers(
      sock,
      rawTargets
    );

    const successList = [];
    const skippedAlready = [];

    for (const targetJid of validTargets) {
      if (action === "add") {
        if (db.data.settings.admins.includes(targetJid)) {
          skippedAlready.push(targetJid);
          continue;
        }
        db.data.settings.admins.push(targetJid);
        db.getUser(targetJid);
        db.updateUser(targetJid, { registered: true, premium: true });
        successList.push(targetJid);
      } else if (action === "remove" || action === "del") {
        const index = db.data.settings.admins.indexOf(targetJid);
        if (index === -1) {
          skippedAlready.push(targetJid);
          continue;
        }
        db.data.settings.admins.splice(index, 1);
        successList.push(targetJid);
      }
    }

    if (successList.length > 0) {
      db.updatePrivilegedCache();
      db.save();
    }

    // 4. REPORT
    let reportText = `👑 *Laporan Pembaruan Admin Bot (${action.charAt(0).toUpperCase() + action.slice(1)})*\n\n`;

    if (successList.length > 0) {
      reportText += `✅ *Berhasil Diproses (${successList.length}):*\n`;
      successList.forEach((j) => {
        reportText += `• @${j.split("@")[0]}\n`;
      });
      reportText += "\n";
    }

    if (skippedAlready.length > 0) {
      reportText += `ℹ️ *Sudah Dalam Status Tersebut (${skippedAlready.length}):*\n`;
      skippedAlready.forEach((j) => {
        reportText += `• @${j.split("@")[0]}\n`;
      });
      reportText += "\n";
    }

    if (invalidTargets.length > 0) {
      reportText += `❌ *Nomor Tidak Terdaftar di WhatsApp (${invalidTargets.length}):*\n`;
      invalidTargets.forEach((j) => {
        reportText += `• ${j.split("@")[0]}\n`;
      });
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: reportText.trim(), mentions: successList },
      { quoted: msg }
    );
  },
};
