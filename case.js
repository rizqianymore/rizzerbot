import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { db } from "@/lib/database.js";
import { settings } from "@/config/settings.js";
import {
  getMenu,
  getUserMenu,
  getPremiumMenu,
  getOwnerMenu,
} from "@/lib/view.js";
import { getThumbnailBuffer } from "@/lib/imageHelper.js";
import {
  getUptimeString,
  broadcastLock,
  randomDelay,
  sleep,
} from "@/lib/utils.js";
import {
  caseCommands,
  ownerCommands,
  premiumCommands,
  aliasesMap,
} from "@/lib/commands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMenuBanner() {
  const imgPath = settings.linkImage || settings.image;
  if (!imgPath) return null;
  if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
    return { url: imgPath };
  }
  const resolvedPath = path.resolve(process.cwd(), imgPath);
  if (fs.existsSync(resolvedPath)) {
    return { url: resolvedPath };
  }
  const relativePath = path.join(__dirname, imgPath);
  if (fs.existsSync(relativePath)) {
    return { url: relativePath };
  }
  return null;
}

export function hasCommand(commandName) {
  return caseCommands.has(commandName.toLowerCase());
}

export default async function handleCase(
  sock,
  msg,
  commandName,
  args,
  context,
) {
  const cmdLower = commandName.toLowerCase();
  const targetCmd = aliasesMap[cmdLower] || cmdLower;

  const {
    logger,
    senderName,
    senderJid,
    isOwner,
    userProfile,
    activePrefix,
    getTargetJid,
    getTargetNumber,
    sendTyping,
    sendUsage,
  } = context;

  // Check permissions
  if (ownerCommands.has(targetCmd) && !isOwner) {
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "🚫 *Akses Ditolak:* Perintah ini hanya dapat digunakan oleh Owner bot.",
      },
      { quoted: msg },
    );
    return true;
  }

  if (premiumCommands.has(targetCmd) && !isOwner && !userProfile.premium) {
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "👑 *Khusus Premium:* Perintah ini memerlukan status Premium.",
      },
      { quoted: msg },
    );
    return true;
  }

  switch (targetCmd) {
    case "developer": {
      const run = async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const devText = `👨‍💻 *Developer & Penjual Bot*

• *Developer:* wa.me/6287847566690
• *Penjual:* wa.me/6287847566690

📝 *Penjelasan Bot:*
Kyros-MD adalah WhatsApp Bot modular berperforma tinggi yang dirancang untuk kebutuhan promosi massal (JPM), manajemen grup secara otomatis, serta pengunduhan berbagai media (Instagram, TikTok, YouTube, Spotify) dengan kecepatan respons optimal.

💰 *Daftar Harga Pembelian:*
• *Pembelian Source Code:* Rp 25.000 (Full script & gratis panduan instalasi)`;

        await sock.sendMessage(
          msg.key.remoteJid,
          { text: devText },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "donate": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();

        const donationText =
          `💖 *Donasi Kyros-MD*\n\n` +
          `Terima kasih telah menggunakan bot kami! Jika Anda menyukai layanan bot ini dan ingin membantu agar bot tetap aktif online 24 jam, Anda dapat menyisihkan donasi melalui metode berikut:\n\n` +
          `• *Dana:* ${settings.danaNumber}\n` +
          `• *Gopay:* ${settings.gopayNumber}\n` +
          `• *OVO:* ${settings.ovoNumber}\n` +
          `• *Saweria:* ${settings.saweriaUrl}\n\n` +
          `📝 *Catatan:* Jika Anda sudah berdonasi, harap kirimkan bukti transfer/pembayaran Anda ke Owner bot agar dapat kami proses atau sekadar mengucapkan terima kasih!\n\n` +
          `Terima kasih banyak atas segala dukungan Anda. Setiap donasi sangat berarti untuk kelangsungan server bot agar selalu stabil!\n\n` +
          `Owner Bot: *${settings.ownerName}*`;

        const qrisPath = "./assets/qris.png";

        try {
          if (fs.existsSync(qrisPath)) {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                image: { url: qrisPath },
                caption: donationText,
              },
              { quoted: msg },
            );
          } else {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                text: donationText,
              },
              { quoted: msg },
            );
          }
        } catch (err) {
          console.error("Donation command error:", err.message);
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: donationText,
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "help": {
      const run = async (sock, msg, args, { sendTyping, senderName }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const userCount = Object.keys(db.data.users).filter(
          (k) => db.data.users[k].registered,
        ).length;
        const totalHits = db.data.stats.totalCommands || 0;

        const menuText = getMenu(senderName);

        const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${getUptimeString()} | User: ${userCount} | Hits: ${totalHits}`;

        const bannerImage = getMenuBanner();

        if (bannerImage) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { image: bannerImage, caption: menuText },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: menuText },
            { quoted: msg }
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "ping": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const start = Date.now();
        const pingMsg = await sock.sendMessage(
          msg.key.remoteJid,
          { text: "Pinging..." },
          { quoted: msg },
        );
        const end = Date.now();
        await sock.sendMessage(msg.key.remoteJid, {
          text: `Pong! 🏓\nKecepatan respon: ${end - start}ms`,
          edit: pingMsg.key,
        });
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "register": {
      const run = async (
        sock,
        msg,
        args,
        { sendTyping, senderJid, userProfile, activePrefix, isOwner },
      ) => {
        const isRegOpen = db.data.settings.registrationOpen !== false;
        if (!isRegOpen && !isOwner) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Pendaftaran pengguna baru sedang ditutup sementara oleh Owner!",
            },
            { quoted: msg },
          );
          return;
        }

        const quotedJid =
          msg.message.extendedTextMessage?.contextInfo?.participant;
        const targetJid = quotedJid || senderJid;

        if (quotedJid && !isOwner) {
          const remoteJid = msg.key.remoteJid;
          let isSenderAdmin = false;
          if (remoteJid.endsWith("@g.us")) {
            try {
              const groupMetadata = await sock.groupMetadata(remoteJid);
              const participants = groupMetadata.participants || [];
              const sender = participants.find(
                (p) =>
                  p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
              );
              isSenderAdmin =
                sender?.admin === "admin" || sender?.admin === "superadmin";
            } catch (_) {}
          }
          if (!isSenderAdmin) {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat mendaftarkan orang lain!",
              },
              { quoted: msg },
            );
            return;
          }
        }

        const targetProfile = db.getUser(targetJid);
        if (targetProfile.registered) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `⚠️ @${targetJid.split("@")[0]} sudah terdaftar!`,
              mentions: [targetJid],
            },
            { quoted: msg },
          );
          return;
        }

        let regName = args.join(" ");
        if (!regName) {
          if (quotedJid) {
            regName = targetJid.split("@")[0];
          } else {
            regName = msg.pushName || senderJid.split("@")[0];
          }
        }

        if (regName.length > 20) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap masukkan nama yang valid (maksimal 20 karakter).",
            },
            { quoted: msg },
          );
          return;
        }

        await sendTyping();
        db.updateUser(targetJid, { registered: true, name: regName });
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ *Pendaftaran Berhasil!*\n\n*Nama:* ${regName}\n*User JID:* @${targetJid.split("@")[0]}\n\nAnda sekarang dapat menggunakan perintah bot. Ketik *${activePrefix}help* untuk melihat daftar perintah!`,
            mentions: [targetJid],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "usermenu": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        let uptimeString = "";
        if (hours > 0) uptimeString += `${hours}j `;
        if (minutes > 0 || hours > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;

        const userCount = Object.keys(db.data.users).filter(
          (k) => db.data.users[k].registered,
        ).length;
        const totalHits = db.data.stats.totalCommands || 0;

        const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${uptimeString} | User: ${userCount} | Hits: ${totalHits}`;

        const menuText = getUserMenu();

        const bannerImage = getMenuBanner();

        if (bannerImage) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { image: bannerImage, caption: menuText },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: menuText },
            { quoted: msg }
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "add": {
      const run = async (
        sock,
        msg,
        args,
        { isOwner, senderJid, sendUsage },
      ) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          let targetNumber = args[0]?.replace(/[^0-9]/g, "");
          if (!targetNumber) {
            await sendUsage();
            return;
          }
          const target = targetNumber + "@s.whatsapp.net";

          await sock.groupParticipantsUpdate(remoteJid, [target], "add");
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil menambahkan @${targetNumber}`,
              mentions: [target],
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            {
              text: "❌ Gagal menambahkan anggota. Pastikan nomor valid atau setelan privasi mereka mengizinkan.",
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "addadmin": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const normalizedSender = msg.key.participant || msg.key.remoteJid;
        const normalizedOwner = settings.ownerNumber.replace(/:.*@/, "@");
        const isMainOwner =
          msg.key.fromMe ||
          normalizedSender.replace(/:.*@/, "@").split("@")[0] ===
            normalizedOwner.split("@")[0];
        if (!isMainOwner) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "👑 Perintah ini hanya dapat digunakan oleh Owner Utama!" },
            { quoted: msg },
          );
          return;
        }

        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }

        if (!db.data.settings.admins) {
          db.data.settings.admins = [];
        }
        if (db.data.settings.admins.includes(target)) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `⚠️ @${target.split("@")[0]} sudah menjadi Admin Bot.`,
              mentions: [target],
            },
            { quoted: msg },
          );
          return;
        }

        db.data.settings.admins.push(target);
        db.updatePrivilegedCache();
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `👑 Berhasil menambahkan @${target.split("@")[0]} sebagai Admin Bot.`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "addbot": {
      const run = async (sock, msg, args, { sendTyping }) => {
        const targetNumber = args[0]?.replace(/[^0-9]/g, "");
        if (!targetNumber) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.addbot 628xxx*",
            },
            { quoted: msg },
          );
          return;
        }
        await sendTyping();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⏳ Sedang menginisialisasi sesi baru untuk ${targetNumber}...`,
          },
          { quoted: msg },
        );
        try {
          const { addSecondaryBot } = await import("@/index.js");
          const code = await addSecondaryBot(targetNumber);
          if (code) {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                text: `🔑 *PAIRING CODE BOT BARU (${targetNumber}):*\n\n*Code:* \`${code}\`\n\nMasukkan kode di atas pada WhatsApp di nomor tersebut (Perangkat Tertaut > Tautkan dengan nomor telepon).`,
              },
              { quoted: msg },
            );
          } else {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                text: `✅ Sesi untuk nomor ${targetNumber} sudah terhubung sebelumnya dan aktif!`,
              },
              { quoted: msg },
            );
          }
        } catch (err) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `❌ Gagal menambahkan bot sekunder: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "addplugin": {
      const run = async (sock, msg, args, { activePrefix, sendTyping }) => {
        await sendTyping();
        const remoteJid = msg.key.remoteJid;

        let code = args.slice(1).join(" ");
        const targetPathInput = args[0];

        const quoted =
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          code =
            quoted.conversation || quoted.extendedTextMessage?.text || code;
        }

        if (!targetPathInput || !code) {
          await sock.sendMessage(
            remoteJid,
            {
              text: `⚠️ *Format salah!*\n\nContoh: \`${activePrefix}addplugin plugins/downloader/tes.js <kode>\` atau balas/quote pesan teks kode dengan perintah \`${activePrefix}addplugin plugins/downloader/tes.js\``,
            },
            { quoted: msg },
          );
          return;
        }

        const projectRoot = process.cwd();
        const absolutePath = path.resolve(projectRoot, targetPathInput);

        const isUnderPlugins = absolutePath.startsWith(
          path.join(projectRoot, "plugins") + path.sep,
        );
        const isUnderCase = absolutePath.startsWith(
          path.join(projectRoot, "case") + path.sep,
        );

        if (!isUnderPlugins && !isUnderCase) {
          await sock.sendMessage(
            remoteJid,
            {
              text: "❌ *Akses ditolak:* File harus disimpan di dalam folder `plugins/` atau `case/`!",
            },
            { quoted: msg },
          );
          return;
        }

        if (!targetPathInput.endsWith(".js")) {
          await sock.sendMessage(
            remoteJid,
            {
              text: "❌ *Tipe tidak valid:* File harus berakhiran `.js`!",
            },
            { quoted: msg },
          );
          return;
        }

        try {
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(absolutePath, code, "utf-8");
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ *Berhasil:* File plugin telah ditulis ke \`${targetPathInput}\` dan siap dimuat otomatis.`,
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            {
              text: `❌ *Error:* Gagal menulis file. \n\n*Pesan:* ${err.message}`,
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "addprem": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }
        const targetProfile = db.getUser(target);
        const defaultName = targetProfile.name || target.split("@")[0];
        db.updateUser(target, {
          premium: true,
          registered: true,
          name: defaultName,
        });
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `👑 Berhasil menambahkan @${target.split("@")[0]} ke daftar Premium & otomatis Terdaftar`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "antibot": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }

        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal memeriksa metadata grup." },
            { quoted: msg },
          );
          return;
        }

        const option = args[0]?.toLowerCase();
        if (option === "on" || option === "1" || option === "aktif") {
          db.updateGroup(remoteJid, { antibot: true });
          await sock.sendMessage(
            remoteJid,
            {
              text: "✅ *Anti-Bot diaktifkan!* Bot lain yang mengirim pesan akan dikeluarkan otomatis.",
            },
            { quoted: msg },
          );
        } else if (
          option === "off" ||
          option === "0" ||
          option === "nonaktif"
        ) {
          db.updateGroup(remoteJid, { antibot: false });
          await sock.sendMessage(
            remoteJid,
            { text: "🚫 *Anti-Bot dinonaktifkan!*" },
            { quoted: msg },
          );
        } else {
          const groupConfig = db.getGroup(remoteJid);
          await sock.sendMessage(
            remoteJid,
            {
              text: `⚠️ Penggunaan: *.antibot on/off*\nStatus saat ini: *${groupConfig?.antibot ? "AKTIF" : "NONAKTIF"}*`,
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "antilink": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }

        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal memeriksa metadata grup." },
            { quoted: msg },
          );
          return;
        }

        const option = args[0]?.toLowerCase();
        if (option === "on" || option === "1" || option === "aktif") {
          db.updateGroup(remoteJid, { antilink: true });
          await sock.sendMessage(
            remoteJid,
            {
              text: "✅ *Anti-Link diaktifkan!* Semua pesan berisi tautan/link dari non-admin akan dihapus otomatis.",
            },
            { quoted: msg },
          );
        } else if (
          option === "off" ||
          option === "0" ||
          option === "nonaktif"
        ) {
          db.updateGroup(remoteJid, { antilink: false });
          await sock.sendMessage(
            remoteJid,
            { text: "🚫 *Anti-Link dinonaktifkan!*" },
            { quoted: msg },
          );
        } else {
          const groupConfig = db.getGroup(remoteJid);
          await sock.sendMessage(
            remoteJid,
            {
              text: `⚠️ Penggunaan: *.antilink on/off*\nStatus saat ini: *${groupConfig?.antilink ? "AKTIF" : "NONAKTIF"}*`,
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "ban": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }
        db.updateUser(target, { banned: true });
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `🚫 Akses bot untuk @${target.split("@")[0]} telah diblokir`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "block": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon." },
            { quoted: msg },
          );
          return;
        }
        await sock.updateBlockStatus(target, "block");
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Berhasil memblokir @${target.split("@")[0]}`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "broadcast": {
      const run = async (sock, msg, args, { sendTyping }) => {
        const text = args.join(" ");
        if (!text) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tentukan teks." },
            { quoted: msg },
          );
          return;
        }
        await sendTyping();
        const users = Object.keys(db.data.users);
        let success = 0;
        for (const user of users) {
          try {
            await sock.sendMessage(user, { text: `📢 *Broadcast*\n\n${text}` });
            success++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (_) {}
        }
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Berhasil dikirim ke ${success}/${users.length} pengguna.`,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "bukadaftar": {
      const run = async (sock, msg, args) => {
        db.data.settings.registrationOpen = true;
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "📲 Pendaftaran pengguna baru berhasil *DIBUKA*." },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "deladmin": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const normalizedSender = msg.key.participant || msg.key.remoteJid;
        const normalizedOwner = settings.ownerNumber.replace(/:.*@/, "@");
        const isMainOwner =
          msg.key.fromMe ||
          normalizedSender.replace(/:.*@/, "@").split("@")[0] ===
            normalizedOwner.split("@")[0];
        if (!isMainOwner) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "👑 Perintah ini hanya dapat digunakan oleh Owner Utama!" },
            { quoted: msg },
          );
          return;
        }

        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }

        if (
          !db.data.settings.admins ||
          !db.data.settings.admins.includes(target)
        ) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `⚠️ @${target.split("@")[0]} tidak terdaftar sebagai Admin Bot.`,
              mentions: [target],
            },
            { quoted: msg },
          );
          return;
        }

        db.data.settings.admins = db.data.settings.admins.filter(
          (a) => a !== target,
        );
        db.updatePrivilegedCache();
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `💔 Berhasil menghapus @${target.split("@")[0]} dari daftar Admin Bot.`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "delbot": {
      const run = async (sock, msg, args) => {
        const targetNumber = args[0]?.replace(/[^0-9]/g, "");
        if (!targetNumber) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.delbot 628xxx*",
            },
            { quoted: msg },
          );
          return;
        }
        try {
          const { stopSecondaryBot } = await import("@/index.js");
          await stopSecondaryBot(targetNumber);
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `🗑️ Sesi dan bot sekunder untuk nomor ${targetNumber} berhasil dihentikan dan dihapus.`,
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `❌ Gagal menghapus bot sekunder: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "delprem": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }
        db.updateUser(target, { premium: false });
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `💔 Berhasil menghapus akses premium untuk @${target.split("@")[0]}`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "deluser": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        let target = getTargetJid(args);
        let normalizedJid = target ? db.normalizeJid(target) : null;
        let foundKey = null;

        if (normalizedJid && db.data.users[normalizedJid]) {
          foundKey = normalizedJid;
        } else {
          if (args && args[0]) {
            const cleanArgNum = args[0].replace(/[^0-9]/g, "");
            if (cleanArgNum) {
              foundKey = Object.keys(db.data.users).find((key) => {
                const keyNum = key.split("@")[0].replace(/[^0-9]/g, "");
                return (
                  keyNum === cleanArgNum ||
                  keyNum.endsWith(cleanArgNum) ||
                  cleanArgNum.endsWith(keyNum)
                );
              });
            }
          }

          if (!foundKey && args && args.length > 0) {
            const searchName = args.join(" ").toLowerCase();
            foundKey = Object.keys(db.data.users).find((key) => {
              const name = db.data.users[key].name || "";
              return (
                name.toLowerCase() === searchName ||
                name.toLowerCase().includes(searchName)
              );
            });
          }
        }

        if (!foundKey) {
          const queryDisplay = args && args[0] ? args.join(" ") : "pengguna";
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `⚠️ Pengguna "${queryDisplay}" tidak ditemukan di database.`,
            },
            { quoted: msg },
          );
          return;
        }

        if (db.isPrivilegedJid(foundKey)) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Tidak dapat menghapus Owner Utama atau Admin Bot dari database!",
            },
            { quoted: msg },
          );
          return;
        }

        const deletedName =
          db.data.users[foundKey].name || foundKey.split("@")[0];
        delete db.data.users[foundKey];
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `🗑️ Berhasil menghapus ${deletedName} (@${foundKey.split("@")[0]}) dari database.`,
            mentions: [foundKey],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "demote": {
      const run = async (
        sock,
        msg,
        args,
        { isOwner, senderJid, getTargetJid, sendUsage },
      ) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const target = getTargetJid(args);
          if (!target) {
            await sendUsage();
            return;
          }

          await sock.groupParticipantsUpdate(remoteJid, [target], "demote");
          await sock.sendMessage(
            remoteJid,
            {
              text: `💔 Jabatan admin @${target.split("@")[0]} berhasil dicabut.`,
              mentions: [target],
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal menurunkan jabatan admin." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "follow": {
      const run = async (sock, msg, args, { sendUsage }) => {
        const target = args[0];
        if (!target) {
          await sendUsage();
          return;
        }
        try {
          let jid = target;
          if (target.includes("whatsapp.com/channel/")) {
          }
          await sock.newsletterFollow(jid);
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `✅ Berhasil mengikuti saluran: ${jid}` },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `❌ Gagal mengikuti saluran: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "getbio": {
      const run = async (sock, msg, args, { getTargetJid, sendUsage }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sendUsage();
          return;
        }
        try {
          const status = await sock.fetchStatus(target);
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: `👤 *Status Profil @${target.split("@")[0]}*\n\n*Bio:* ${status?.status || "Tidak ada bio"}\n*Terakhir Diperbarui:* ${status?.setAt ? new Date(status.setAt).toLocaleString("id-ID") : "Tidak diketahui"}`,
              mentions: [target],
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `❌ Gagal mengambil bio pengguna: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "getdb": {
      const run = async (sock, msg, args) => {
        const dbFilePath = path.join(
          __dirname,
          "..",
          "..",
          "database",
          "users.json",
        );

        if (fs.existsSync(dbFilePath)) {
          const buffer = fs.readFileSync(dbFilePath);
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              document: buffer,
              mimetype: "application/json",
              fileName: "users.json",
              caption: "📊 users.json saat ini.",
            },
            { quoted: msg },
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "❌ File database tidak ditemukan." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "group": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const option = args[0]?.toLowerCase();
          if (option === "open" || option === "buka") {
            await sock.groupSettingUpdate(remoteJid, "not_announcement");
            await sock.sendMessage(
              remoteJid,
              {
                text: "🔓 Setelan grup berhasil diubah: *Semua anggota sekarang dapat mengirim pesan!*",
              },
              { quoted: msg },
            );
          } else if (option === "close" || option === "tutup") {
            await sock.groupSettingUpdate(remoteJid, "announcement");
            await sock.sendMessage(
              remoteJid,
              {
                text: "🔒 Setelan grup berhasil diubah: *Hanya admin yang dapat mengirim pesan!*",
              },
              { quoted: msg },
            );
          } else {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Penggunaan: *.group open* / *.group close*" },
              { quoted: msg },
            );
          }
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal mengubah setelan grup." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "groupinfo": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const metadata = await sock.groupMetadata(remoteJid);
          const admins = metadata.participants.filter(
            (p) => p.admin === "admin" || p.admin === "superadmin",
          );
          const owner =
            metadata.owner ||
            metadata.participants.find((p) => p.admin === "superadmin")?.id ||
            "Tidak diketahui";

          const info =
            `📝 *INFORMASI GRUP:*\n\n` +
            `• *Nama Grup:* ${metadata.subject}\n` +
            `• *ID Grup:* \`${metadata.id}\`\n` +
            `• *Pembuat/Owner:* @${owner.split("@")[0]}\n` +
            `• *Dibuat Pada:* ${new Date(metadata.creation * 1000).toLocaleString("id-ID")}\n` +
            `• *Total Anggota:* ${metadata.participants.length}\n` +
            `• *Total Admin:* ${admins.length}\n` +
            `• *Deskripsi:* \n${metadata.desc || "Tidak ada deskripsi."}`;

          await sock.sendMessage(
            remoteJid,
            { text: info, mentions: [owner] },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal mengambil informasi grup: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "hidetag": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const targetJids = participants.map((p) => p.id);
          const text = args.join(" ") || "";
          await sock.sendMessage(remoteJid, { text, mentions: targetJids });
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal mengirim hidetag." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "jagagrup": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }

        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal memeriksa metadata grup." },
            { quoted: msg },
          );
          return;
        }

        const option = args[0]?.toLowerCase();
        if (option === "on" || option === "aktif" || option === "1") {
          db.updateGroup(remoteJid, { guard: true });
          await sock.sendMessage(
            remoteJid,
            {
              text: "✅ *Penjaga Grup (Group Guard) AKTIF!*\nBot akan otomatis melindungi posisi Admin Owner dari demote tidak sah.",
            },
            { quoted: msg },
          );
        } else if (
          option === "off" ||
          option === "nonaktif" ||
          option === "0"
        ) {
          db.updateGroup(remoteJid, { guard: false });
          await sock.sendMessage(
            remoteJid,
            { text: "🚫 *Penjaga Grup (Group Guard) NONAKTIF!*" },
            { quoted: msg },
          );
        } else {
          const groupConfig = db.getGroup(remoteJid);
          await sock.sendMessage(
            remoteJid,
            {
              text: `⚠️ Penggunaan: *.jagagrup on/off*\nStatus saat ini: *${groupConfig?.guard ? "AKTIF" : "NONAKTIF"}*`,
            },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "jpm": {
      const run = async (sock, msg, args, context) => {
        const { sendTyping, activePrefix, commandName } = context;
        const remoteJid = msg.key.remoteJid;
        const text = args.join(" ");
        const botJid = (sock.user?.id || "").replace(/:.*@/, "@");

        if (commandName === "addjpmch") {
          await sendTyping();
          const input = args[0];
          if (!input) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `⚠️ *Penggunaan:* \`${activePrefix}addjpmch [JID/Link Channel]\``,
              },
              { quoted: msg },
            );
            return;
          }

          let targetJid = input;
          if (input.includes("whatsapp.com/channel/")) {
            const match = input.match(/channel\/([a-zA-Z0-9\-]+)/i);
            if (match) {
              try {
                const meta = await sock.newsletterMetadata("invite", match[1]);
                if (meta?.id) {
                  targetJid = meta.id;
                } else {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      text: "❌ Tidak dapat mengambil JID channel dari tautan tersebut.",
                    },
                    { quoted: msg },
                  );
                  return;
                }
              } catch (err) {
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `❌ Gagal mengambil metadata channel: ${err.message}`,
                  },
                  { quoted: msg },
                );
                return;
              }
            }
          }

          if (!targetJid.endsWith("@newsletter")) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "❌ JID Channel tidak valid. Harus berakhiran @newsletter",
              },
              { quoted: msg },
            );
            return;
          }

          const channels = db.data.settings.jpmChannels || [];
          if (channels.includes(targetJid)) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Channel tersebut sudah ada di daftar JPM!" },
              { quoted: msg },
            );
            return;
          }

          channels.push(targetJid);
          db.data.settings.jpmChannels = channels;
          db.save();
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil menambahkan channel ke database JPM:\n\`${targetJid}\``,
            },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "deljpmch") {
          await sendTyping();
          const targetJid = args[0];
          if (!targetJid) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `⚠️ *Penggunaan:* \`${activePrefix}deljpmch [JID Channel]\``,
              },
              { quoted: msg },
            );
            return;
          }

          let channels = db.data.settings.jpmChannels || [];
          if (!channels.includes(targetJid)) {
            await sock.sendMessage(
              remoteJid,
              { text: "❌ JID Channel tidak ditemukan di daftar JPM!" },
              { quoted: msg },
            );
            return;
          }

          db.data.settings.jpmChannels = channels.filter(
            (id) => id !== targetJid,
          );
          db.save();
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil menghapus channel dari database JPM:\n\`${targetJid}\``,
            },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "listjpmch") {
          await sendTyping();
          const channels = db.data.settings.jpmChannels || [];
          if (channels.length === 0) {
            await sock.sendMessage(
              remoteJid,
              { text: "📋 *Daftar JPM Channel kosong.*" },
              { quoted: msg },
            );
            return;
          }
          const listText =
            `📋 *Daftar Target JPM Channel* (${channels.length})\n\n` +
            channels.map((jid, i) => `${i + 1}. \`${jid}\``).join("\n");
          await sock.sendMessage(
            remoteJid,
            { text: listText },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "checkdb") {
          await sendTyping();
          const users = db.data.users;
          const totalUsers = Object.keys(users).length;
          const registered = Object.values(users).filter(
            (u) => u.registered,
          ).length;
          const premium = Object.values(users).filter((u) => u.premium).length;
          const totalGroups = Object.keys(db.data.groups || {}).length;
          const totalCh = (db.data.settings.jpmChannels || []).length;
          const totalHits = db.data.stats.totalCommands || 0;

          const div = "─".repeat(30);
          await sock.sendMessage(
            remoteJid,
            {
              text:
                `📊 *Statistik Database Kelola* 📊\n${div}\n\n` +
                `• *Total Kontak/User:* ${totalUsers} pengguna\n` +
                `• *Terdaftar:* ${registered} pengguna\n` +
                `• *Premium:* ${premium} pengguna\n` +
                `• *Total Grup Aktif:* ${totalGroups} grup\n` +
                `• *Target JPM Channel:* ${totalCh} channel\n` +
                `• *Total Hits Perintah:* ${totalHits} kali\n\n` +
                `${div}\n_*${settings.botName} Database Engine*_`,
            },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "addjpmblacklist" || commandName === "addjpmbl") {
          await sendTyping();
          let targetJid = "";
          const input = args[0];

          if (input) {
            if (input.includes("chat.whatsapp.com/")) {
              const code = input.split("chat.whatsapp.com/")[1]?.split(" ")[0];
              if (code) {
                try {
                  const meta = await sock.groupGetInviteInfo(code);
                  if (meta?.id) {
                    targetJid = meta.id;
                  } else {
                    await sock.sendMessage(
                      remoteJid,
                      {
                        text: "❌ Tidak dapat mengambil JID grup dari tautan tersebut.",
                      },
                      { quoted: msg },
                    );
                    return;
                  }
                } catch (err) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      text: `❌ Gagal mengambil metadata grup: ${err.message}`,
                    },
                    { quoted: msg },
                  );
                  return;
                }
              }
            } else {
              targetJid = input;
            }
          } else if (remoteJid.endsWith("@g.us")) {
            targetJid = remoteJid;
          }

          if (!targetJid || !targetJid.endsWith("@g.us")) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `⚠️ *Penggunaan:* \`${activePrefix}addjpmblacklist [JID/Link Grup]\` atau gunakan langsung di dalam grup.`,
              },
              { quoted: msg },
            );
            return;
          }

          const blacklist = db.data.settings.jpmBlacklist || [];
          if (blacklist.includes(targetJid)) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Grup tersebut sudah ada di daftar blacklist JPM!" },
              { quoted: msg },
            );
            return;
          }

          blacklist.push(targetJid);
          db.data.settings.jpmBlacklist = blacklist;
          db.save();
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil menambahkan grup ke blacklist JPM:\n\`${targetJid}\``,
            },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "deljpmblacklist" || commandName === "deljpmbl") {
          await sendTyping();
          const targetJid =
            args[0] || (remoteJid.endsWith("@g.us") ? remoteJid : "");

          if (!targetJid) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `⚠️ *Penggunaan:* \`${activePrefix}deljpmblacklist [JID Grup]\` atau gunakan langsung di dalam grup.`,
              },
              { quoted: msg },
            );
            return;
          }

          let blacklist = db.data.settings.jpmBlacklist || [];
          if (!blacklist.includes(targetJid)) {
            await sock.sendMessage(
              remoteJid,
              { text: "❌ JID Grup tidak ditemukan di daftar blacklist JPM!" },
              { quoted: msg },
            );
            return;
          }

          db.data.settings.jpmBlacklist = blacklist.filter(
            (id) => id !== targetJid,
          );
          db.save();
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil menghapus grup dari blacklist JPM:\n\`${targetJid}\``,
            },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "listjpmblacklist" || commandName === "listjpmbl") {
          await sendTyping();
          const blacklist = db.data.settings.jpmBlacklist || [];
          if (blacklist.length === 0) {
            await sock.sendMessage(
              remoteJid,
              { text: "📋 *Daftar Blacklist JPM kosong.*" },
              { quoted: msg },
            );
            return;
          }
          const listText =
            `📋 *Daftar Blacklist JPM Grup* (${blacklist.length})\n\n` +
            blacklist.map((jid, i) => `${i + 1}. \`${jid}\``).join("\n");
          await sock.sendMessage(
            remoteJid,
            { text: listText },
            { quoted: msg },
          );
          return;
        }

        if (commandName === "jpmch") {
          if (broadcastLock.has(botJid)) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!",
              },
              { quoted: msg },
            );
            return;
          }

          const targetChannels = db.data.settings.jpmChannels || [];
          if (targetChannels.length === 0) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `❌ Daftar target channel kosong! Silakan tambah dengan \`${activePrefix}addjpmch\` terlebih dahulu.`,
              },
              { quoted: msg },
            );
            return;
          }

          const quotedMsg =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!text && !quotedMsg) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Harap masukkan pesan promosi atau quote media untuk JPM Channel!",
              },
              { quoted: msg },
            );
            return;
          }

          await sendTyping();
          await sock.sendMessage(
            remoteJid,
            {
              text: `⏳ *Memulai JPM ke ${targetChannels.length} Channel Terdaftar...*`,
            },
            { quoted: msg },
          );

          broadcastLock.set(botJid, true);
          let success = 0;
          let batchCounter = 0;

          try {
            for (const jid of targetChannels) {
              try {
                if (quotedMsg) {
                  await sock.sendMessage(jid, {
                    forward:
                      msg.message.extendedTextMessage.contextInfo.quotedMessage,
                  });
                  if (text) await sock.sendMessage(jid, { text });
                } else {
                  await sock.sendMessage(jid, { text });
                }
                success++;
                batchCounter++;

                if (batchCounter >= 10) {
                  batchCounter = 0;
                  await sleep(15_000);
                } else {
                  await randomDelay(4_000, 7_000);
                }
              } catch (err) {
                console.error(
                  `Gagal kirim JPM Channel ke ${jid}:`,
                  err.message,
                );
              }
            }
            await sock.sendMessage(
              remoteJid,
              {
                text: `✅ *JPM Channel Selesai!*\nBerhasil mengirim ke *${success}/${targetChannels.length}* channel.`,
              },
              { quoted: msg },
            );
          } finally {
            broadcastLock.delete(botJid);
          }
          return;
        }

        if (commandName === "jpm" || commandName === "bcgc") {
          if (broadcastLock.has(botJid)) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Perangkat ini sedang menjalankan tugas broadcast/push lainnya!",
              },
              { quoted: msg },
            );
            return;
          }

          const quotedMsg =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!text && !quotedMsg) {
            await sock.sendMessage(
              remoteJid,
              {
                text: `📢 *JPM Broadcast System*\n\nFormat: \`${activePrefix}jpm [teks]\` atau quote/balas media dengan \`.jpm\``,
              },
              { quoted: msg },
            );
            return;
          }

          await sendTyping();
          await sock.sendMessage(
            remoteJid,
            { text: "⏳ *Memulai JPM ke semua grup...*" },
            { quoted: msg },
          );

          broadcastLock.set(botJid, true);
          let success = 0;
          let batchCounter = 0;

          try {
            const allGroups = await sock.groupFetchAllParticipating();
            const rawJids = Object.keys(allGroups || {});
            const blacklist = db.data.settings.jpmBlacklist || [];
            const groupJids = rawJids.filter((jid) => !blacklist.includes(jid));

            if (groupJids.length === 0) {
              await sock.sendMessage(
                remoteJid,
                {
                  text: "❌ Bot tidak bergabung di grup manapun (atau semua grup masuk blacklist).",
                },
                { quoted: msg },
              );
              return;
            }

            const div = "─".repeat(30);

            for (const jid of groupJids) {
              try {
                if (quotedMsg) {
                  await sock.sendMessage(jid, {
                    forward:
                      msg.message.extendedTextMessage.contextInfo.quotedMessage,
                  });
                  if (text) await sock.sendMessage(jid, { text });
                } else {
                  await sock.sendMessage(jid, {
                    text: `📢 *Informasi Bersama*\n${div}\n\n${text}\n\n${div}\n_*Sent via ${settings.botName}*_`,
                  });
                }
                success++;
                batchCounter++;

                if (batchCounter >= 10) {
                  batchCounter = 0;
                  await sleep(15_000);
                } else {
                  await randomDelay(4_000, 7_000);
                }
              } catch (err) {
                console.error(`Gagal JPM ke ${jid}:`, err.message);
              }
            }

            await sock.sendMessage(
              remoteJid,
              {
                text: `✅ *JPM Selesai!*\nBerhasil dikirim ke *${success}/${groupJids.length}* grup.`,
              },
              { quoted: msg },
            );
          } finally {
            broadcastLock.delete(botJid);
          }
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "delmember": {
      const run = async (
        sock,
        msg,
        args,
        { isOwner, senderJid, getTargetJid, sendUsage },
      ) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const target = getTargetJid(args);
          if (!target) {
            await sendUsage();
            return;
          }

          await sock.groupParticipantsUpdate(remoteJid, [target], "remove");
          await sock.sendMessage(
            remoteJid,
            {
              text: `✅ Berhasil mengeluarkan @${target.split("@")[0]}`,
              mentions: [target],
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal mengeluarkan anggota." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "linkgc": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const code = await sock.groupInviteCode(remoteJid);
          await sock.sendMessage(
            remoteJid,
            {
              text: `🔗 *Link Undangan Grup:*\nhttps://chat.whatsapp.com/${code}`,
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal mengambil link grup: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "listadmin": {
      const run = async (sock, msg, args) => {
        const admins = db.data.settings.admins || [];
        if (admins.length === 0) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "ℹ️ Tidak ada admin bot tambahan yang terdaftar." },
            { quoted: msg },
          );
          return;
        }

        const list = admins
          .map((jid, idx) => `${idx + 1}. @${jid.split("@")[0]}`)
          .join("\n");
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `👥 *DAFTAR ADMIN BOT:*\n\n${list}`,
            mentions: admins,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "listbot": {
      const run = async (sock, msg, args) => {
        try {
          const { runningBots } = await import("@/index.js");
          if (runningBots.size === 0) {
            await sock.sendMessage(
              msg.key.remoteJid,
              { text: "ℹ️ Tidak ada bot sekunder yang sedang berjalan." },
              { quoted: msg },
            );
            return;
          }
          let listText = `🤖 *Daftar bot sekunder aktif (${runningBots.size}):*\n\n`;
          let idx = 1;
          for (const key of runningBots.keys()) {
            const phoneNumber = key.replace("session_", "");
            listText += `${idx++}. @${phoneNumber} (Aktif & Terhubung)\n`;
          }
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: listText,
              mentions: Array.from(runningBots.keys()).map(
                (k) => k.replace("session_", "") + "@s.whatsapp.net",
              ),
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: `❌ Gagal mengambil daftar bot: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "listuser": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();

        const users = Object.entries(db.data.users);
        if (users.length === 0) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "ℹ️ Belum ada pengguna terdaftar di database." },
            { quoted: msg },
          );
          return;
        }

        const totalUsers = users.length;
        const registeredUsers = users.filter(([_, u]) => u.registered).length;
        const premiumUsers = users.filter(([_, u]) => u.premium).length;
        const bannedUsers = users.filter(([_, u]) => u.banned).length;

        let listText =
          `📊 *Statistik Pengguna Kyros-MD*\n\n` +
          `• *Total Pengguna:* ${totalUsers}\n` +
          `• *Terdaftar:* ${registeredUsers}\n` +
          `• *Premium:* ${premiumUsers}\n` +
          `• *Diblokir (Banned):* ${bannedUsers}\n\n` +
          `📝 *Daftar Pengguna Terdaftar:*\n\n`;

        users.forEach(([jid, u], index) => {
          const num = jid.split("@")[0];
          const name = u.name || "Tanpa Nama";
          const premStatus = u.premium ? " [👑]" : "";
          const banStatus = u.banned ? " [🚫]" : "";
          listText += `${index + 1}. *${name}* (@${num})${premStatus}${banStatus}\n`;
        });

        const mentions = users.map(([jid]) => jid);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: listText.trim(),
            mentions: mentions,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "maintenance": {
      const run = async (sock, msg, args, context) => {
        const { sendTyping } = context;
        await sendTyping();

        const remoteJid = msg.key.remoteJid;
        const subCommand = args[0]?.toLowerCase();

        if (subCommand === "wipe" || subCommand === "wipedatabase") {
          db.data.users = {};
          db.data.stats = {
            totalCommands: 0,
            commands: {},
          };
          db.data.groups = {};
          db.data.settings.jpmChannels = [];

          const botJid = db.normalizeJid(sock.user?.id);
          const ownerJid = db.normalizeJid(settings.ownerNumber);
          const pairingJid = db.normalizeJid(settings.pairingNumber);
          const adminJids = (db.data.settings.admins || []).map((a) =>
            db.normalizeJid(a),
          );

          const defaultPrivileged = Array.from(
            new Set([botJid, ownerJid, pairingJid, ...adminJids]),
          ).filter(Boolean);

          for (const jid of defaultPrivileged) {
            db.data.users[jid] = {
              registered: true,
              name:
                jid === ownerJid || jid === pairingJid
                  ? settings.ownerName
                  : jid === botJid
                    ? settings.botName
                    : "Admin",
              banned: false,
              premium: true,
              limit: 100,
              joinedAt: new Date().toISOString(),
            };
          }
          db.save();

          await sock.sendMessage(
            remoteJid,
            {
              text: "🗑️ *Wipe Database:* BERHASIL\n\nSeluruh data pengguna, statistik, dan grup telah dihapus bersih dari database. Nomor bot, owner, dan admin telah didaftarkan secara otomatis sebagai pengguna Premium.\n\nMemulai ulang bot dalam 3 detik untuk menerapkan perubahan...",
            },
            { quoted: msg },
          );

          setTimeout(() => {
            process.exit(0);
          }, 3000);
          return;
        }

        let targetState = !db.data.settings.maintenance;
        if (subCommand === "on") targetState = true;
        if (subCommand === "off") targetState = false;

        if (!targetState) {
          db.data.settings.maintenance = false;
          db.save();
          await sock.sendMessage(
            remoteJid,
            {
              text: "🛠️ *Mode Pemeliharaan:* NONAKTIF\n\nBot telah kembali ke mode normal. Semua pengguna sekarang dapat menggunakannya kembali.",
            },
            { quoted: msg },
          );
          return;
        }

        db.data.settings.maintenance = true;
        db.save();

        await sock.sendMessage(
          remoteJid,
          {
            text: "🛠️ *Mode Pemeliharaan:* AKTIF\n\nSistem pemeliharaan sedang berjalan. Memulai restrukturisasi database dan pembersihan cache/log...",
          },
          { quoted: msg },
        );

        let logOutput = "🛠️ *Proses Pemeliharaan Sistem dan Pembersihan*\n\n";
        let success = true;

        try {
          logOutput += "📂 *1. Restrukturisasi & Format Database:*\n";
          const dbDir = path.join(projectRoot, "database");
          if (fs.existsSync(dbDir)) {
            const dbFiles = fs
              .readdirSync(dbDir)
              .filter((f) => f.endsWith(".json"));
            for (const file of dbFiles) {
              const filePath = path.join(dbDir, file);
              if (!isSafePath(filePath)) continue;

              try {
                const raw = fs.readFileSync(filePath, "utf8");
                let parsed = {};
                try {
                  parsed = JSON.parse(raw);
                } catch (_) {
                  parsed =
                    file === "users.json" || file === "groups.json" ? {} : [];
                }

                fs.writeFileSync(
                  filePath,
                  JSON.stringify(parsed, null, 4),
                  "utf8",
                );
                logOutput += `   ✅ \`${file}\` berhasil diformat ulang.\n`;
              } catch (e) {
                logOutput += `   ❌ Gagal memproses \`${file}\`: ${e.message}\n`;
                success = false;
              }
            }

            db.load();
            db.ensurePrivilegedUsers();
            logOutput += "   🔄 Database berhasil dimuat ulang ke memori.\n\n";
          } else {
            logOutput += "   ⚠️ Direktori database tidak ditemukan.\n\n";
            success = false;
          }

          logOutput += "🧹 *2. Pembersihan Cache & File Sementara:*\n";
          let clearedFilesCount = 0;
          let clearedBytes = 0;

          const targets = [
            path.join(projectRoot, "statuses"),
            path.join(projectRoot, "tmp"),
            path.join(projectRoot, "temp"),
            path.join(projectRoot, ".cache"),
          ];

          for (const dirPath of targets) {
            if (fs.existsSync(dirPath)) {
              const resolved = path.resolve(dirPath);
              if (!isSafePath(resolved)) continue;

              const stat = fs.statSync(resolved);
              if (stat.isDirectory()) {
                const files = fs.readdirSync(resolved);
                for (const file of files) {
                  const filePath = path.join(resolved, file);
                  const fileResolved = path.resolve(filePath);
                  if (!isSafePath(fileResolved)) continue;

                  try {
                    const fileStat = fs.statSync(fileResolved);
                    if (fileStat.isFile()) {
                      clearedBytes += fileStat.size;
                      fs.unlinkSync(fileResolved);
                      clearedFilesCount++;
                    } else if (fileStat.isDirectory()) {
                      fs.rmSync(fileResolved, { recursive: true, force: true });
                      clearedFilesCount++;
                    }
                  } catch (_) {}
                }
              }
            }
          }

          try {
            const rootFiles = fs.readdirSync(projectRoot);
            for (const file of rootFiles) {
              if (
                file.endsWith(".log") ||
                /.*\.tmp\.(mp4|gif|png|jpg)$/.test(file)
              ) {
                const filePath = path.join(projectRoot, file);
                const fileResolved = path.resolve(filePath);
                if (!isSafePath(fileResolved)) continue;

                try {
                  const stat = fs.statSync(fileResolved);
                  if (stat.isFile()) {
                    clearedBytes += stat.size;
                    fs.unlinkSync(fileResolved);
                    clearedFilesCount++;
                  }
                } catch (_) {}
              }
            }
          } catch (_) {}

          const sizeMb = (clearedBytes / (1024 * 1024)).toFixed(2);
          logOutput += `   ✅ Berhasil menghapus *${clearedFilesCount}* file sampah.\n`;
          logOutput += `   💾 Total penyimpanan dibebaskan: *${sizeMb} MB*.\n\n`;

          logOutput +=
            "✨ *Pemeliharaan Selesai!* Bot sekarang berjalan dengan optimal.\n\n🔄 *Memulai ulang bot* dalam 3 detik untuk menerapkan perubahan secara menyeluruh...";
        } catch (err) {
          logOutput += `\n❌ *Terjadi Kesalahan saat Pemeliharaan:* ${err.message}`;
          success = false;
        }

        db.data.settings.maintenance = false;
        db.save();

        await sock.sendMessage(remoteJid, { text: logOutput }, { quoted: msg });

        if (success) {
          setTimeout(() => {
            process.exit(0);
          }, 3000);
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "ownermenu": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const activePrefix = db.data.settings.prefix || settings.prefix;
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        let uptimeString = "";
        if (hours > 0) uptimeString += `${hours}j `;
        if (minutes > 0 || hours > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;

        const userCount = Object.keys(db.data.users).filter(
          (k) => db.data.users[k].registered,
        ).length;
        const totalHits = db.data.stats.totalCommands || 0;

        const statsBody = `Owner: ${settings.ownerName} | Prefix: [ ${activePrefix} ] | Uptime: ${uptimeString} | User: ${userCount} | Hits: ${totalHits}`;

        const menuText = getOwnerMenu();
        const bannerImage = getMenuBanner();

        if (bannerImage) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { image: bannerImage, caption: menuText },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: menuText },
            { quoted: msg }
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "promote": {
      const run = async (
        sock,
        msg,
        args,
        { isOwner, senderJid, getTargetJid, sendUsage },
      ) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const target = getTargetJid(args);
          if (!target) {
            await sendUsage();
            return;
          }

          await sock.groupParticipantsUpdate(remoteJid, [target], "promote");
          await sock.sendMessage(
            remoteJid,
            {
              text: `👑 @${target.split("@")[0]} sekarang adalah Admin Grup.`,
              mentions: [target],
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal mempromosikan anggota." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "public": {
      const run = async (sock, msg, args) => {
        db.data.settings.selfMode = false;
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `🔓 *Mode Umum:* AKTIF\nSemua pengguna dapat menggunakan bot.`,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "pushkontak": {
      const run = async (sock, msg, args, context) => {
        const { sendTyping, activePrefix } = context;
        const botJid = (sock.user?.id || "").replace(/:.*@/, "@");

        if (broadcastLock.has(botJid)) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Perangkat ini sedang menjalankan tugas broadcast/push kontak lainnya. Harap tunggu!",
            },
            { quoted: msg },
          );
          return;
        }

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini harus dijalankan di dalam grup target!" },
            { quoted: msg },
          );
          return;
        }

        const text = args.join(" ");
        if (!text) {
          const guideText =
            `👥 *Push Kontak System*\n\n` +
            `Mengirimkan pesan pribadi secara beruntun ke seluruh anggota grup target.\n\n` +
            `• *Format:* \`${activePrefix}pushkontak [pesan promosi/salam]\``;
          await sock.sendMessage(
            remoteJid,
            { text: guideText },
            { quoted: msg },
          );
          return;
        }

        await sendTyping();
        await sock.sendMessage(
          remoteJid,
          {
            text: "⏳ Memulai proses push kontak dengan konfigurasi anti-ban (delay acak + jeda kelompok sedang aktif)...",
          },
          { quoted: msg },
        );

        broadcastLock.set(botJid, true);

        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];

          const targets = participants
            .map((p) => p.id)
            .filter((jid) => jid.replace(/:.*@/, "@") !== botJid);

          if (targets.length === 0) {
            await sock.sendMessage(
              remoteJid,
              { text: "❌ Tidak ada anggota grup target lainnya." },
              { quoted: msg },
            );
            return;
          }

          let success = 0;
          let batchCounter = 0;

          for (const targetJid of targets) {
            if (!broadcastLock.has(botJid)) break;

            try {
              await sock.sendMessage(targetJid, { text: text });
              success++;
              batchCounter++;

              if (batchCounter >= 10) {
                batchCounter = 0;
                console.log(
                  `[Push Kontak] Batch break aktif (15s) setelah mengirim ke 10 kontak.`,
                );
                await sleep(15_000);
              } else {
                await randomDelay(3_000, 5_500);
              }
            } catch (err) {
              console.error(`Gagal mengirim PM ke ${targetJid}:`, err.message);
            }
          }

          const reportText =
            `✅ *Push Kontak Selesai!*\n\n` +
            `👥 *Laporan Transmisi:*\n` +
            `• Status: Sukses\n` +
            `• Terkirim: *${success}/${targets.length}* anggota secara pribadi.\n\n` +
            `🛡️ _Proses pengiriman diselesaikan dengan aman menggunakan Anti-Spam humanized patterns._`;

          await sock.sendMessage(
            remoteJid,
            { text: reportText },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal memproses push kontak: ${err.message}` },
            { quoted: msg },
          );
        } finally {
          broadcastLock.delete(botJid);
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "resetdb": {
      const run = async (sock, msg, args) => {
        db.data.users = {};
        db.data.stats = { totalCommands: 0, commands: {} };
        db.ensurePrivilegedUsers();
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "✅ Database statistik dan pengguna telah di-reset." },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "revoke": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          const code = await sock.groupRevokeInvite(remoteJid);
          await sock.sendMessage(
            remoteJid,
            {
              text: `🔄 Link undangan grup berhasil di-reset.\n\n*Link Baru:*\nhttps://chat.whatsapp.com/${code}`,
            },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal me-reset link grup: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "self": {
      const run = async (sock, msg, args) => {
        db.data.settings.selfMode = true;
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `👤 *Mode Mandiri:* AKTIF\nBot hanya menerima perintah dari Owner.`,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "setbotname": {
      const run = async (sock, msg, args) => {
        const name = args.join(" ");
        if (!name) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tentukan nama bot baru." },
            { quoted: msg },
          );
          return;
        }
        settings.botName = name;
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `✅ Nama bot diubah menjadi: *${name}*` },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "setdesc": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        const newDesc = args.join(" ");
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          await sock.groupUpdateDescription(remoteJid, newDesc);
          await sock.sendMessage(
            remoteJid,
            { text: "✅ Deskripsi grup berhasil diubah!" },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal mengubah deskripsi grup: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "setname": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        const newName = args.join(" ");
        if (!newName) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Harap masukkan nama grup yang baru!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const botJid = sock.user.id.replace(/:.*@/, "@");
          const botParticipant = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === botJid,
          );
          const isBotAdmin =
            botParticipant?.admin === "admin" ||
            botParticipant?.admin === "superadmin";
          if (!isBotAdmin) {
            await sock.sendMessage(
              remoteJid,
              { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
              { quoted: msg },
            );
            return;
          }

          await sock.groupUpdateSubject(remoteJid, newName);
          await sock.sendMessage(
            remoteJid,
            { text: `✅ Nama grup berhasil diubah menjadi: *${newName}*` },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: `❌ Gagal mengubah nama grup: ${err.message}` },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "setownername": {
      const run = async (sock, msg, args) => {
        const name = args.join(" ");
        if (!name) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tentukan nama owner baru." },
            { quoted: msg },
          );
          return;
        }
        settings.ownerName = name;
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `✅ Nama owner diubah menjadi: *${name}*` },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "setprefix": {
      const run = async (sock, msg, args) => {
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tentukan karakter prefix (1-3 karakter)." },
            { quoted: msg },
          );
          return;
        }
        db.data.settings.prefix = newPrefix;
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `🎯 Prefix perintah bot berhasil diubah ke: "${newPrefix}"` },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "shutdown": {
      const run = async (sock, msg, args) => {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "💤 Menghidupkan mode tidur/Mematikan proses bot..." },
          { quoted: msg },
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        process.exit(0);
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "stats": {
      const run = async (sock, msg, args, { activePrefix }) => {
        const total = db.data.stats.totalCommands;
        const userCount = Object.keys(db.data.users).length;
        const entries = Object.entries(db.data.stats.commands);
        let topCommands =
          entries.length > 0
            ? entries
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(
                  ([cmd, count], idx) =>
                    `${idx + 1}. *${activePrefix}${cmd}* : ${count}`,
                )
                .join("\n")
            : "Belum ada data.";
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `📊 *Statistik Bot*\nTotal Penggunaan Perintah: ${total}\nPengguna Terdaftar: ${userCount}\n\n🔥 *Top 5 Perintah*:\n${topCommands}`,
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "tagall": {
      const run = async (sock, msg, args, { isOwner, senderJid }) => {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith("@g.us")) {
          await sock.sendMessage(
            remoteJid,
            { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
            { quoted: msg },
          );
          return;
        }
        try {
          const groupMetadata = await sock.groupMetadata(remoteJid);
          const participants = groupMetadata.participants || [];
          const sender = participants.find(
            (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@"),
          );
          const isSenderAdmin =
            sender?.admin === "admin" ||
            sender?.admin === "superadmin" ||
            isOwner;

          if (!isSenderAdmin) {
            await sock.sendMessage(
              remoteJid,
              {
                text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!",
              },
              { quoted: msg },
            );
            return;
          }

          const messageText = args.join(" ") || "Halo semua!";
          let tagText = `📢 *Tag All*\n\n*Pesan:* ${messageText}\n\n`;
          const targetJids = participants.map((p) => p.id);
          targetJids.forEach((jid, idx) => {
            tagText += `${idx + 1}. @${jid.split("@")[0]}\n`;
          });

          await sock.sendMessage(
            remoteJid,
            { text: tagText, mentions: targetJids },
            { quoted: msg },
          );
        } catch (err) {
          await sock.sendMessage(
            remoteJid,
            { text: "❌ Gagal melakukan tagall." },
            { quoted: msg },
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "tutupdaftar": {
      const run = async (sock, msg, args) => {
        db.data.settings.registrationOpen = false;
        db.save();
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "📴 Pendaftaran pengguna baru berhasil *DITUTUP*." },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "unban": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon pengguna.",
            },
            { quoted: msg },
          );
          return;
        }
        db.updateUser(target, { banned: false });
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Akses bot untuk @${target.split("@")[0]} telah dipulihkan`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "unblock": {
      const run = async (sock, msg, args, { getTargetJid }) => {
        const target = getTargetJid(args);
        if (!target) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon." },
            { quoted: msg },
          );
          return;
        }
        await sock.updateBlockStatus(target, "unblock");
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Berhasil membuka blokir @${target.split("@")[0]}`,
            mentions: [target],
          },
          { quoted: msg },
        );
      };
      await run(sock, msg, args, context);
      return true;
    }

    case "premiummenu": {
      const run = async (sock, msg, args, { sendTyping }) => {
        await sendTyping();
        const menuText = getPremiumMenu();
        const bannerImage = getMenuBanner();

        if (bannerImage) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { image: bannerImage, caption: menuText },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: menuText },
            { quoted: msg }
          );
        }
      };
      await run(sock, msg, args, context);
      return true;
    }

    default:
      return false;
  }
}
