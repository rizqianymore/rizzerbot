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
  name: "limited",
  aliases: ["limitrole", "addlimited", "dellimited"],
  description: "Manajemen Akses Khusus / Role Limited (CCTV & Fitur Sensitif) via nomor telepon.",
  usage: "<add/remove/list> <nomor1 nomor2... | tag>",
  example: "limited add 08123456789 08987654321",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `🔒 *MANAJEMEN ROLE LIMITED (CCTV & FITUR KHUSUS)*\n\n` +
            `│ ${activePrefix}limited add <nomor1 nomor2... | tag>\n` +
            `│ ${activePrefix}limited remove <nomor1 nomor2... | tag>\n` +
            `│ ${activePrefix}limited list\n\n` +
            `*Catatan:* Mendukung multi-nomor sekaligus & auto-validasi nomor WhatsApp.`,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    // 1. LIST LIMITED USERS
    if (action === "list") {
      const allLimited = Object.keys(db.data.users).filter(
        (u) => db.data.users[u].limited || db.data.users[u].role === "limited"
      );

      if (allLimited.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🔒 Belum ada pengguna dengan role *Limited* terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `🔒 *DAFTAR PENGGUNA LIMITED (${allLimited.length})*\n\n`;
      allLimited.forEach((lim, i) => {
        textList += `${i + 1}. @${lim.split("@")[0]}\n`;
      });
      textList += `\n_Pengguna di atas memiliki izin akses monitoring CCTV & fitur sensitif._`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions: allLimited },
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
        { text: "⚠️ Masukkan minimal satu nomor telepon valid atau tag pengguna target!" },
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
      const user = db.getUser(targetJid);

      if (action === "add") {
        if (user.limited) {
          skippedAlready.push(targetJid);
          continue;
        }
        db.updateUser(targetJid, { limited: true, registered: true });
        successList.push(targetJid);
      } else if (action === "remove" || action === "del") {
        if (!user.limited) {
          skippedAlready.push(targetJid);
          continue;
        }
        db.updateUser(targetJid, { limited: false });
        successList.push(targetJid);
      }
    }

    // 4. REPORT
    let reportText = `🔒 *LAPORAN UPDATE LIMITED (${action.toUpperCase()})*\n\n`;

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
