import { createMailbox, getMessages, readMessage } from "@/src/services/network/tempmail.js";
import { db } from "@/src/core/database.js";

export default {
  name: "tempmail",
  aliases: ["dropmail", "fakemail", "disposablemail", "mailtemp"],
  description: "Buat email sekali pakai (temporary mail) real-time untuk verifikasi akun & OTP",
  usage: "[create | check | read <id> | delete]",
  premiumOnly: false,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";
    const subCmd = (args[0] || "").toLowerCase();

    const user = db.getUser(senderJid) || {};
    const activeMail = user.tempMail || null;

    if (!subCmd || subCmd === "help") {
      let infoText =
        `*TEMPORARY EMAIL REAL-TIME*\n\n` +
        `Layanan email sekali pakai untuk verifikasi akun, kode OTP, dan menjaga privasi tanpa spam.\n\n` +
        `*Panduan Penggunaan:*\n` +
        `• *${p}tempmail create* (Buat email random baru)\n` +
        `• *${p}tempmail check* (Cek kotak masuk / inbox real-time)\n` +
        `• *${p}tempmail read <id>* (Buka & baca isi email)\n` +
        `• *${p}tempmail delete* (Hapus sesi email aktif)\n\n`;

      if (activeMail) {
        infoText += `*Status Akun Anda:* Sedang aktif\n• *Email:* \`${activeMail}\``;
      } else {
        infoText += `*Status Akun Anda:* Belum ada email aktif. Ketik *${p}tempmail create* untuk membuat.`;
      }

      return reply(infoText.trim());
    }

    if (subCmd === "create" || subCmd === "new" || subCmd === "buat") {
      const customPrefix = args[1] || null;
      const mailbox = createMailbox(customPrefix);

      db.updateUser(senderJid, { tempMail: mailbox.address });

      return reply(
        `*EMAIL SEMENTARA BERHASIL DIBUAT!*\n\n` +
          `• *Alamat Email:* \`${mailbox.address}\`\n` +
          `• *Status:* Aktif & Siap Menerima Pesan\n\n` +
          `Gunakan email ini untuk mendaftar atau verifikasi. Bila kode/email sudah dikirim, ketik:\n` +
          `*${p}tempmail check* untuk melihat kotak masuk.`
      );
    }

    if (subCmd === "check" || subCmd === "inbox" || subCmd === "pesan") {
      const emailToCheck = args[1] || activeMail;
      if (!emailToCheck) {
        return reply(
          `Kamu belum memiliki email aktif.\n\nKetik *${p}tempmail create* untuk membuat baru, atau *${p}tempmail check user@domain.com*.`
        );
      }

      try {
        const messages = await getMessages(emailToCheck);
        if (!messages || messages.length === 0) {
          return reply(
            `*KOTAK MASUK (INBOX)*\n` +
              `Email: \`${emailToCheck}\`\n\n` +
              `_Belum ada pesan masuk. Kirim email/OTP ke alamat ini lalu cek kembali dalam beberapa detik._`
          );
        }

        let body = `*KOTAK MASUK: \`${emailToCheck}\`* (${messages.length} Pesan)\n\n`;
        messages.slice(0, 10).forEach((m, idx) => {
          body += `*${idx + 1}. [ID: ${m.id}]*\n`;
          body += `• *Dari:* ${m.from}\n`;
          body += `• *Subjek:* ${m.subject || "(Tanpa Subjek)"}\n`;
          body += `• *Waktu:* ${m.date}\n`;
          body += `• *Baca:* \`${p}tempmail read ${m.id}\`\n\n`;
        });

        body += `_Ketik ${p}tempmail read <ID> untuk melihat isi pesan lengkap._`;
        return reply(body.trim());
      } catch (err) {
        return reply(`[FAIL] Gagal memeriksa kotak masuk: ${err.message}`);
      }
    }

    if (subCmd === "read" || subCmd === "baca" || subCmd === "open") {
      const messageId = args[1];
      if (!messageId) {
        return reply(`Format salah. Gunakan: *${p}tempmail read <ID_PESAN>*`);
      }

      const emailToRead = activeMail;
      if (!emailToRead) {
        return reply(`Kamu belum memiliki email aktif. Buat terlebih dahulu dengan *${p}tempmail create*.`);
      }

      try {
        const fullMsg = await readMessage(emailToRead, messageId);

        let content = fullMsg.textBody ? fullMsg.textBody.trim() : "";
        if (!content && fullMsg.htmlBody) {
          content = fullMsg.htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }

        let result =
          `*DETAIL PESAN MASUK*\n\n` +
          `• *ID:* ${fullMsg.id}\n` +
          `• *Dari:* ${fullMsg.from}\n` +
          `• *Kepada:* \`${emailToRead}\`\n` +
          `• *Subjek:* ${fullMsg.subject || "(Tanpa Subjek)"}\n` +
          `• *Waktu:* ${fullMsg.date}\n\n`;

        // Ekstraksi otomatis kode verifikasi / OTP (angka 4-8 digit)
        const combined = `${fullMsg.subject || ""} ${content || ""}`;
        const otpMatch = combined.match(/\b(?<!\w)(\d{4,8})\b/);
        if (otpMatch) {
          result += `🔑 *KODE OTP TERDETEKSI:* \`${otpMatch[1]}\`\n\n`;
        }

        result += `*Isi Pesan:*\n${content || "(Pesan kosong)"}`;

        if (fullMsg.attachments && fullMsg.attachments.length > 0) {
          result += `\n\n*Lampiran (${fullMsg.attachments.length}):*\n`;
          fullMsg.attachments.forEach((att) => {
            result += `• ${att.filename} (${(att.size / 1024).toFixed(1)} KB)\n`;
          });
        }

        return reply(result.slice(0, 4000));
      } catch (err) {
        return reply(`[FAIL] Gagal membaca pesan: ${err.message}`);
      }
    }

    if (subCmd === "delete" || subCmd === "hapus" || subCmd === "reset") {
      if (!activeMail) {
        return reply("Tidak ada sesi temp-mail aktif yang perlu dihapus.");
      }

      db.updateUser(senderJid, { tempMail: null });
      return reply(`Sesi temporary email (\`${activeMail}\`) berhasil dihapus.`);
    }

    return reply(`Perintah tidak dikenal. Ketik *${p}tempmail* untuk melihat panduan.`);
  },
};
