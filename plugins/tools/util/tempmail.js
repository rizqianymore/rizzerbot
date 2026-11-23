import {
  createUniversalMailbox,
  getUniversalMessages,
  readUniversalMessage,
} from "@/src/services/network/tempmail.js";
import { db } from "@/src/core/database.js";

export default {
  name: "tempmail",
  aliases: ["dropmail", "fakemail", "disposablemail", "mailtemp", "10minutemail"],
  description: "Buat email sekali pakai (temporary mail) real-time untuk verifikasi akun & OTP (10MinuteMail / Guerrilla)",
  usage: "[create | check | read <id> | delete]",
  premiumOnly: false,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";
    const subCmd = (args[0] || "").toLowerCase();

    const user = db.getUser(senderJid) || {};
    const session = user.tempMailSession || null;

    if (!subCmd || subCmd === "help") {
      let infoText =
        `*TEMPORARY EMAIL REAL-TIME*\n\n` +
        `Layanan email sekali pakai untuk verifikasi akun, kode OTP, dan privasi tanpa spam.\n\n` +
        `*Panduan Penggunaan:*\n` +
        `• *${p}tempmail create* (Buat email 10MinuteMail baru)\n` +
        `• *${p}tempmail create guerrilla* (Buat alternatif GuerrillaMail)\n` +
        `• *${p}tempmail check* (Cek kotak masuk / inbox real-time)\n` +
        `• *${p}tempmail read <id>* (Buka & baca isi email)\n` +
        `• *${p}tempmail delete* (Hapus sesi email aktif)\n\n`;

      if (session?.address) {
        infoText += `*Status Akun Anda:* Sedang aktif\n• *Email:* \`${session.address}\`\n• *Provider:* ${session.provider} (${session.expiresIn})`;
      } else {
        infoText += `*Status Akun Anda:* Belum ada email aktif. Ketik *${p}tempmail create* untuk membuat.`;
      }

      return reply(infoText.trim());
    }

    if (subCmd === "create" || subCmd === "new" || subCmd === "buat") {
      const engine = (args[1] || "auto").toLowerCase();
      try {
        const mailbox = await createUniversalMailbox(engine);
        db.updateUser(senderJid, {
          tempMail: mailbox.address,
          tempMailSession: mailbox,
        });

        return reply(
          `┌── EMAIL SEMENTARA BARU\n` +
            `│ Alamat: \`${mailbox.address}\`\n` +
            `│ Provider: ${mailbox.provider}\n` +
            `│ Durasi: ${mailbox.expiresIn}\n` +
            `│ Status: Aktif & Siap Menerima\n` +
            `└─\n\n` +
            `Kirim OTP/verifikasi ke alamat di atas, lalu ketik:\n` +
            `*${p}tempmail check* untuk melihat kotak masuk.`
        );
      } catch (err) {
        return reply(`Gagal membuat email sementara: ${err.message}`);
      }
    }

    if (subCmd === "check" || subCmd === "inbox" || subCmd === "pesan") {
      if (!session?.address) {
        return reply(
          `Kamu belum memiliki email aktif.\n\nKetik *${p}tempmail create* untuk membuat baru.`
        );
      }

      try {
        const messages = await getUniversalMessages(session);
        if (!messages || messages.length === 0) {
          return reply(
            `*KOTAK MASUK (INBOX)*\n` +
              `Email: \`${session.address}\`\n\n` +
              `_Belum ada pesan masuk. Kirim email/OTP ke alamat ini lalu cek kembali dalam beberapa detik._`
          );
        }

        let body = `*KOTAK MASUK: \`${session.address}\`* (${messages.length} Pesan)\n\n`;
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

      if (!session?.address) {
        return reply(`Kamu belum memiliki email aktif. Buat terlebih dahulu dengan *${p}tempmail create*.`);
      }

      try {
        const fullMsg = await readUniversalMessage(session, messageId);
        const content = fullMsg.textBody ? fullMsg.textBody.trim() : "(Pesan kosong)";

        let result =
          `*DETAIL PESAN MASUK*\n\n` +
          `• *ID:* ${fullMsg.id}\n` +
          `• *Dari:* ${fullMsg.from}\n` +
          `• *Kepada:* \`${session.address}\`\n` +
          `• *Subjek:* ${fullMsg.subject || "(Tanpa Subjek)"}\n` +
          `• *Waktu:* ${fullMsg.date}\n\n`;

        const combined = `${fullMsg.subject || ""} ${content || ""}`;
        const otpMatch = combined.match(/\b(?<!\w)(\d{4,8})\b/);
        if (otpMatch) {
          result += `🔑 *KODE OTP TERDETEKSI:* \`${otpMatch[1]}\`\n\n`;
        }

        result += `*Isi Pesan:*\n${content}`;
        return reply(result.slice(0, 4000));
      } catch (err) {
        return reply(`[FAIL] Gagal membaca pesan: ${err.message}`);
      }
    }

    if (subCmd === "delete" || subCmd === "hapus" || subCmd === "reset") {
      if (!session?.address) {
        return reply("Tidak ada sesi temp-mail aktif yang perlu dihapus.");
      }

      db.updateUser(senderJid, {
        tempMail: null,
        tempMailSession: null,
      });
      return reply(`Sesi temporary email (\`${session.address}\`) berhasil dihapus.`);
    }

    return reply(`Perintah tidak dikenal. Ketik *${p}tempmail* untuk melihat panduan.`);
  },
};

