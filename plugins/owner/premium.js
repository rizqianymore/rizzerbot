import { db } from "@/src/core/database.js";
import { parsePhoneNumbers } from "@/src/utils/helper.js";

async function validateWhatsAppNumbers(sock, jids) {
  const valid = [];
  const invalid = [];

  for (const jid of jids) {
    const cleanJid = db.normalizeJid(jid);
    // Jika JID berformat LID (@lid) atau JID grup / sudah ada di DB user
    if (cleanJid.endsWith("@lid") || cleanJid.endsWith("@g.us") || db.data.users[cleanJid]) {
      valid.push(cleanJid);
      continue;
    }

    try {
      const check = await sock.onWhatsApp(cleanJid);
      if (check && check.length > 0 && check[0].exists) {
        valid.push(db.normalizeJid(check[0].jid || cleanJid));
      } else {
        // Fallback: jika check tidak menemukan atau onWhatsApp mengembalikan empty, tapi format jid valid
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
  name: "premium",
  aliases: ["prem"],
  description: "Manajemen Pengguna Premium secara massal atau satuan via nomor telepon.",
  usage: "<add/del/list> <nomor1 nomor2... | tag> [durasi/hari]",
  example: "premium add 08123456789 08987654321 30d",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const action = args[0]?.toLowerCase();
    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⭐ *Manajemen Pengguna Premium (Enterprise)*\n\n` +
                `│ .prem add <nomor1 nomor2... | tag> [durasi]\n` +
                `│ .prem del <nomor1 nomor2... | tag>\n` +
                `│ .prem list\n\n` +
                `*Contoh:* \`.prem add 08123456789 08987654321 30d\`\n` +
                `*Catatan:* Mendukung multi-nomor & auto-cek status aktif WhatsApp.`
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    // 1. LIST SEMUA PREMIUM
    if (action === "list") {
      const allUsers = Object.keys(db.data.users);
      const premiumUsers = allUsers.filter((u) => db.data.users[u].premium);

      if (premiumUsers.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⭐ Belum ada Pengguna Premium tambahan yang terdaftar." },
          { quoted: msg }
        );
        return;
      }

      let textList = `⭐ *DAFTAR PENGGUNA PREMIUM (${premiumUsers.length})*\n\n`;
      premiumUsers.forEach((prem, i) => {
        const u = db.data.users[prem];
        const isPriv = db.isPrivilegedJid(prem);
        const roleBadge = isPriv ? " [Owner/Admin]" : "";
        const expireInfo = u?.premiumExpiresAt ? ` (Exp: ${u.premiumExpiresAt.split("T")[0]})` : " (Permanen)";
        textList += `${i + 1}. @${prem.split("@")[0]}${roleBadge}${expireInfo}\n`;
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: textList.trim(), mentions: premiumUsers },
        { quoted: msg }
      );
      return;
    }

    // 2. PARSE MULTI-TARGET
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;

    let rawTargets = [];
    if (mentionedJids.length > 0) {
      rawTargets.push(...mentionedJids.map((j) => db.normalizeJid(j)));
    }
    if (quotedParticipant) {
      rawTargets.push(db.normalizeJid(quotedParticipant));
    }

    // Detect duration argument if present (e.g., 30d, 7d, 30)
    let durationDays = 0;
    const cleanArgs = [];
    for (const arg of args.slice(1)) {
      const match = arg.match(/^(\d+)(d|hari|day|days)?$/i);
      if (match && !arg.startsWith("08") && arg.length <= 4) {
        durationDays = parseInt(match[1], 10);
      } else {
        cleanArgs.push(arg);
      }
    }

    const parsedFromText = parsePhoneNumbers(cleanArgs);
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
    const skippedPrivileged = [];

    const expiresAt = durationDays > 0
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    for (const targetJid of validTargets) {
      const isPrivileged = db.isPrivilegedJid(targetJid);
      const user = db.getUser(targetJid);

      if (action === "add" || action === "set") {
        db.updateUser(targetJid, {
          premium: true,
          registered: true,
          limit: 99999,
          premiumExpiresAt: expiresAt,
        });
        successList.push(targetJid);
      } else if (action === "remove" || action === "del") {
        if (isPrivileged) {
          skippedPrivileged.push(targetJid);
          continue;
        }
        if (!user.premium) {
          skippedAlready.push(targetJid);
          continue;
        }
        db.updateUser(targetJid, {
          premium: false,
          limit: 100,
          premiumExpiresAt: null,
        });
        successList.push(targetJid);
      }
    }

    // 4. REPORT
    let reportText = `⭐ *Laporan Pembaruan Premium (${action.charAt(0).toUpperCase() + action.slice(1)})*\n\n`;

    if (successList.length > 0) {
      reportText += `✅ *Berhasil Diperbarui (${successList.length}):*\n`;
      successList.forEach((j) => {
        const durText = durationDays > 0 ? ` [Durasi: ${durationDays} Hari]` : ` [Permanen]`;
        reportText += `• @${j.split("@")[0]}${action === "add" ? durText : ""}\n`;
      });
      reportText += "\n";
    }

    if (skippedAlready.length > 0) {
      reportText += `ℹ️ *Sudah Bukan Premium (${skippedAlready.length}):*\n`;
      skippedAlready.forEach((j) => {
        reportText += `• @${j.split("@")[0]}\n`;
      });
      reportText += "\n";
    }

    if (skippedPrivileged.length > 0) {
      reportText += `🛡️ *Dilewati (Owner/Admin Kebal Modifikasi) (${skippedPrivileged.length}):*\n`;
      skippedPrivileged.forEach((j) => {
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
      { text: reportText.trim(), mentions: [...successList, ...skippedPrivileged] },
      { quoted: msg }
    );
  },
};
