import { db } from '@/src/core/database.js';

export default [
  {
    name: "eval",
    description: "Evaluate javascript code",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Perintah evaluasi kode hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      if (!args.length) return reply("Masukkan kode!");
      try {
        let evaled = await eval(args.join(" "));
        if (typeof evaled !== "string") evaled = await import("util").then(u => u.inspect(evaled));
        reply(evaled);
      } catch (err) {
        reply(String(err));
      }
    }
  },
  {
    name: "addowner",
    description: "Tambahkan owner baru ke bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid, botJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addowner 628xx*");
      
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      const isSub = Boolean(sock.isSubBot || (activeBotJid && activeBotJid !== db.normalizeJid(db.getSettings().ownerNumber)));

      if (isSub) {
        const curConfig = db.getBotSettings(activeBotJid);
        const curOwners = Array.isArray(curConfig.ownerNumbers) ? curConfig.ownerNumbers : [];
        if (db.isBotOwner(activeBotJid, jid)) {
          return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Owner bot ini.`);
        }
        db.updateBotSettings(activeBotJid, {
          ownerNumbers: [...new Set([...curOwners, jid])],
        });
        return reply(`👑 Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner khusus bot ini (+${activeBotJid.split("@")[0]}).`);
      }

      if (db.isOwner(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Owner.`);
      db.setOwner(jid, true);
      reply(`👑 Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner Bot Utama.`);
    }
  },
  {
    name: "delowner",
    description: "Hapus owner tambahan dari bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid, botJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delowner 628xx*");
      if (db.isPrimaryOwner(jid)) {
        return reply("❌ Nomor tersebut adalah Primary Owner (Pemilik Utama) dan tidak dapat dihapus!");
      }

      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      const isSub = Boolean(sock.isSubBot || (activeBotJid && activeBotJid !== db.normalizeJid(db.getSettings().ownerNumber)));

      if (isSub) {
        const curConfig = db.getBotSettings(activeBotJid);
        const curOwners = Array.isArray(curConfig.ownerNumbers) ? curConfig.ownerNumbers : [];
        const nextOwners = curOwners.filter((o) => db.normalizeJid(o) !== jid);
        db.updateBotSettings(activeBotJid, { ownerNumbers: nextOwners });
        return reply(`✅ Berhasil mencabut status Owner bot ini dari *${jid.split("@")[0]}*.`);
      }

      if (!db.isOwner(jid)) {
        return reply(`ℹ️ *${jid.split("@")[0]}* bukan Owner.`);
      }

      db.setOwner(jid, false);
      reply(`✅ Berhasil menghapus *${jid.split("@")[0]}* dari daftar Owner Bot.`);
    }
  },
  {
    name: "listowner",
    aliases: ["owners"],
    description: "Lihat daftar semua Owner bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, botJid }) => {
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      const botConfig = db.getBotSettings(activeBotJid);
      const primary = db.normalizeJid(db.getSettings().ownerNumber);
      const botDedicatedOwner = db.normalizeJid(botConfig.ownerNumber);

      const ownerList = [
        primary,
        botDedicatedOwner,
        ...(Array.isArray(botConfig.ownerNumbers) ? botConfig.ownerNumbers : []),
        ...(Array.isArray(db.getSettings().ownerNumbers) ? db.getSettings().ownerNumbers : []),
      ].filter(Boolean);
      const uniqueOwners = [...new Set(ownerList.map(j => db.normalizeJid(j)))];

      let text = `👑 *Daftar Owner (+${activeBotJid.split("@")[0]})*\n\n`;
      uniqueOwners.forEach((j, i) => {
        const num = j.split("@")[0];
        const isMain = j === primary;
        const isDedicated = j === botDedicatedOwner && !isMain;
        text += `${i + 1}. +${num} ${isMain ? "⭐ _(Primary SuperOwner)_" : isDedicated ? "👑 _(Bot Owner)_" : "🔑 _(Owner)_"}\n`;
      });
      text += `\nTotal: ${uniqueOwners.length} owner terdaftar`;
      reply(text);
    }
  },
  {
    name: "addadmin",
    description: "Tambahkan admin bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan Admin Bot hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addadmin 628xx*");
      if (db.isOwner(jid)) return reply("ℹ️ Nomor tersebut sudah menjadi Owner (memiliki hak di atas Admin).");
      if (db.isAdmin(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Admin Bot.`);

      db.setAdmin(jid, true);
      reply(`🛡️ Berhasil menjadikan *${jid.split("@")[0]}* sebagai Admin Bot.`);
    }
  },
  {
    name: "deladmin",
    description: "Hapus admin bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan Admin Bot hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.deladmin 628xx*");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat dihapus melalui perintah deladmin.");
      if (!db.isAdmin(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* bukan Admin Bot.`);

      db.setAdmin(jid, false);
      reply(`✅ Berhasil mencabut akses Admin Bot dari *${jid.split("@")[0]}*.`);
    }
  },
  {
    name: "listadmin",
    aliases: ["admins", "botadmins"],
    description: "Lihat daftar semua Admin bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      const settings = db.getSettings();
      const adminList = Array.isArray(settings.adminNumbers) ? settings.adminNumbers : [];
      const uniqueAdmins = [...new Set(adminList.map(j => db.normalizeJid(j)))].filter(j => !db.isOwner(j));

      if (uniqueAdmins.length === 0) {
        return reply("ℹ️ Belum ada Admin Bot tambahan yang terdaftar.");
      }

      let text = `🛡️ *Daftar Admin*\n\n`;
      uniqueAdmins.forEach((j, i) => {
        const num = j.split("@")[0];
        text += `${i + 1}. +${num}\n`;
      });
      text += `\nTotal: ${uniqueAdmins.length} admin`;
      reply(text);
    }
  },
  {
    name: "addprem",
    description: "Tambahkan pengguna premium",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      let jid = null;
      let durationDays = null;

      // 1. Cek quoted message atau mentions terlebih dahulu
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.remoteJid;
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (quotedJid && !quotedJid.endsWith("@g.us")) {
        jid = db.normalizeJid(quotedJid);
        const days = parseFloat(args[0]);
        if (!isNaN(days) && days > 0) durationDays = days;
      } else if (mentionedJid) {
        jid = db.normalizeJid(mentionedJid);
        // Cari angka durasi setelah mention
        for (const arg of args) {
          const val = parseFloat(arg);
          if (!isNaN(val) && val > 0 && !arg.includes("@") && arg.replace(/\D/g, "").length < 7) {
            durationDays = val;
            break;
          }
        }
      } else if (args.length > 0) {
        // Mode input via teks: contoh: .addprem 6281234567890 30
        const firstDigits = args[0].replace(/\D/g, "");
        if (firstDigits.length >= 7) {
          jid = db.normalizeJid(args[0]);
          if (args[1]) {
            const days = parseFloat(args[1]);
            if (!isNaN(days) && days > 0) durationDays = days;
          }
        } else {
          // Fallback ke getTargetJid jika ada
          jid = getTargetJid(args);
          const lastArg = args[args.length - 1];
          const days = parseFloat(lastArg);
          if (!isNaN(days) && days > 0 && lastArg.replace(/\D/g, "").length < 7) {
            durationDays = days;
          }
        }
      }

      if (!jid) {
        return reply("❌ Balas pesan user atau masukkan nomor! Contoh:\n• *.addprem 628xxx 30* (30 hari)\n• *.addprem 628xxx* (Permanen)");
      }

      if (db.isOwner(jid)) return reply("ℹ️ Owner otomatis memiliki akses Premium selamanya.");
      if (db.isAdmin(jid)) return reply("ℹ️ Admin Bot otomatis memiliki akses Premium selamanya.");

      db.setPremium(jid, true, durationDays);
      reply(`⭐ Berhasil menambahkan *${jid.split("@")[0]}* ke Premium${durationDays ? ` selama ${durationDays} hari` : " (Permanen)"}.`);
    }
  },
  {
    name: "delprem",
    description: "Hapus pengguna premium",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delprem 628xx*");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat kehilangan akses Premium.");
      if (db.isAdmin(jid)) return reply("❌ Admin Bot otomatis memiliki akses Premium.");

      db.setPremium(jid, false);
      reply(`✅ Berhasil menghapus *${jid.split("@")[0]}* dari daftar Premium.`);
    }
  },
  {
    name: "listprem",
    aliases: ["prems", "premiums"],
    description: "Lihat daftar semua user Premium",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      const allPrems = db.getAllPremiumUsers();

      if (allPrems.length === 0) {
        return reply("ℹ️ Belum ada user Premium khusus yang terdaftar.");
      }

      let text = `⭐ *Daftar Pengguna Premium*\n\n`;
      allPrems.forEach((u, i) => {
        const num = u.jid.split("@")[0];
        const status = u.isPermanent ? "Permanen" : `Hingga ${new Date(u.premiumUntil).toLocaleDateString("id-ID")}`;
        text += `${i + 1}. +${num} _(${status})_\n`;
      });
      text += `\nTotal: ${allPrems.length} premium`;
      reply(text);
    }
  },
  {
    name: "access",
    aliases: ["checkaccess", "useraccess"],
    description: "Check user access",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid, senderJid }) => {
      const jid = getTargetJid(args) || senderJid;
      const access = db.getAccess(jid);
      const user = db.getUser(jid);
      if (!user) return reply("Nomor target tidak valid.");
      const until = user.premiumUntil
        ? new Date(user.premiumUntil).toLocaleDateString("id-ID")
        : "Tanpa batas waktu";
      reply(
        `*Status Akses ${jid.split("@")[0]}*\n` +
        `Role: *${access.role}*\n` +
        `Owner: *${access.owner ? "Ya" : "Tidak"}*\n` +
        `Admin: *${access.admin ? "Ya" : "Tidak"}*\n` +
        `Premium: *${access.premium ? "Ya" : "Tidak"}*\n` +
        `Banned: *${access.banned ? "Ya" : "Tidak"}*\n` +
        `Berlaku: *${until}*`
      );
    }
  },
  {
    name: "broadcast",
    aliases: ["bc"],
    description: "Broadcast message",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      if (!args.length) return reply("Masukkan pesan!");
      let chats = Object.keys(await sock.groupFetchAllParticipating());
      for (let jid of chats) {
        await sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${args.join(" ")}` });
      }
      reply(`✅ Broadcast terkirim ke ${chats.length} grup.`);
    }
  },
  {
    name: "setprefix",
    description: "Change bot prefix (opsional: tambahkan --all untuk semua bot)",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, botJid, isPrimarySuperOwner }) => {
      const syncAll = args.includes("--all") || args.includes("-a");
      const cleanArgs = args.filter((a) => a !== "--all" && a !== "-a");
      const prefix = cleanArgs[0] || "";

      if (!prefix || prefix.length > 3 || /\s/.test(prefix)) {
        return reply("❌ Prefix harus berupa 1-3 karakter tanpa spasi.\nContoh: `.setprefix !` atau `.setprefix ! --all` (sinkron ke semua bot)");
      }

      if (syncAll && !isPrimarySuperOwner) {
        return reply("❌ Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
      }

      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

      if (syncAll) {
        db.updateSettings({ prefix });
        const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
        const list = getSubBotsList();
        for (const b of list) {
          const sJid = `${b.number}@s.whatsapp.net`;
          db.updateBotSettings(sJid, { prefix });
        }
        reply(`✅ Prefix berhasil diubah & disinkronkan ke semua bot: \`${prefix}\``);
      } else {
        db.updateBotSettings(activeBotJid, { prefix });
        reply(`✅ Prefix berhasil diubah ke: \`${prefix}\` untuk bot ini (+${activeBotJid.split('@')[0]}).`);
      }
    }
  },
  {
    name: "block",
    description: "Block user",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor!");
      if (db.isOwner(jid)) return reply("❌ Owner tidak dapat diblokir.");
      await sock.updateBlockStatus(jid, "block");
      db.setBanned(jid, true);
      reply(`✅ *${jid.split("@")[0]}* diblokir.`);
    }
  },
  {
    name: "unblock",
    description: "Unblock user",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor!");
      await sock.updateBlockStatus(jid, "unblock");
      db.setBanned(jid, false);
      reply(`✅ *${jid.split("@")[0]}* dibuka blokirnya dan di-unban.`);
    }
  },
  {
    name: "join",
    description: "Join group via link",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      if (!args[0]) return reply("Masukkan link grup!");
      let code = args[0].split("chat.whatsapp.com/")[1];
      await sock.groupAcceptInvite(code);
      reply("✅ Berhasil bergabung.");
    }
  },
  {
    name: "leave",
    description: "Leave current group",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      await sock.groupLeave(msg.key.remoteJid);
    }
  },
  {
    name: "self",
    description: "Set bot to self mode (owner only). Tambahkan --all untuk semua bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, botJid, isPrimarySuperOwner }) => {
      const syncAll = args.includes("--all") || args.includes("-a");
      if (syncAll && !isPrimarySuperOwner) {
        return reply("❌ Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
      }

      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

      if (syncAll) {
        db.updateSettings({ public: false });
        const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
        const list = getSubBotsList();
        for (const b of list) {
          const sJid = `${b.number}@s.whatsapp.net`;
          db.updateBotSettings(sJid, { public: false });
        }
        reply("🔒 *Mode Self (Owner Only)* telah diaktifkan & disinkronkan untuk *SEMUA BOT*.");
      } else {
        db.updateBotSettings(activeBotJid, { public: false });
        reply(`🔒 Bot (+${activeBotJid.split('@')[0]}) sekarang dalam mode Self.`);
      }
    }
  },
  {
    name: "public",
    aliases: ["pub"],
    description: "Set bot to public mode. Tambahkan --all untuk semua bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, botJid, isPrimarySuperOwner }) => {
      const syncAll = args.includes("--all") || args.includes("-a");
      if (syncAll && !isPrimarySuperOwner) {
        return reply("❌ Opsi `--all` hanya dapat digunakan oleh SuperOwner (Owner Bot Utama).");
      }

      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);

      if (syncAll) {
        db.updateSettings({ public: true });
        const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
        const list = getSubBotsList();
        for (const b of list) {
          const sJid = `${b.number}@s.whatsapp.net`;
          db.updateBotSettings(sJid, { public: true });
        }
        reply("🌐 *Mode Public (Semua User)* telah diaktifkan & disinkronkan untuk *SEMUA BOT*.");
      } else {
        db.updateBotSettings(activeBotJid, { public: true });
        reply(`🌐 Bot (+${activeBotJid.split('@')[0]}) sekarang dalam mode Public.`);
      }
    }
  },
  {
    name: "addbot",
    aliases: ["jadibot", "pairbot"],
    description: "Tambahkan bot baru (sub-bot) via pairing code",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, senderJid, getTargetJid }) => {
      await sendTyping();

      // Pengecekan: Akun Sub-Bot atau nomor sub-bot dilarang menambahkan bot lagi
      const { isSubBotSocket, isSubBotNumber } = await import("@/src/services/subbot/subbot.js");
      if (isSubBotSocket(sock) || isSubBotNumber(senderJid)) {
        return reply(
          "❌ *Akses Ditolak!*\n\n" +
          "Akun Sub-Bot tidak diizinkan untuk menambahkan bot baru (*.addbot*). Fitur ini hanya dapat digunakan oleh Bot Utama."
        );
      }

      const number = args[0]?.replace(/[^0-9]/g, "");
      if (!number || number.length < 8) {
        return reply("❌ Masukkan nomor WhatsApp untuk dijadikan bot! Contoh: *.addbot 6281234567890 [nomor_owner]*");
      }

      // Tentukan owner untuk bot ini (jika ada argumen kedua atau default ke pemanggil perintah)
      const targetOwner = args[1] ? db.normalizeJid(args[1]) : senderJid;

      await reply(
        `⏳ Menyiapkan sesi bot untuk *${number}*...\n` +
        `👤 *Owner Bot:* +${targetOwner.split("@")[0]}\n` +
        `⚙️ *Mode:* Pengaturan Mandiri (1 Bot 1 Owner, Self/Public & Prefix Terpisah)\n` +
        `Kode pairing akan dikirimkan sebentar lagi.`
      );

      try {
        const { createSubBot } = await import("@/src/services/subbot/subbot.js");
        await createSubBot(number, async (code) => {
          const message =
            `🔑 *KODE PAIRING BOT BARU*\n\n` +
            `📱 *Nomor Bot:* +${number}\n` +
            `👑 *Owner:* +${targetOwner.split("@")[0]}\n` +
            `⚙️ *Mode:* Pengaturan Mandiri (Self/Public/Prefix Terpisah)\n` +
            `⚠️ *Batasan:* Sub-bot tidak dapat menggunakan fitur .addbot\n` +
            `🔐 *Kode Pairing:* *\`${code}\`*\n\n` +
            `_Buka WhatsApp di nomor tersebut > Perangkat Tertaut > Tautkan dengan nomor telepon, lalu masukkan kode di atas._`;
          await reply(message);
        }, targetOwner);
      } catch (err) {
        await reply(`❌ Gagal membuat sub bot: ${err.message}`);
      }
    }
  },
  {
    name: "listbot",
    aliases: ["bots", "subbots"],
    description: "Melihat daftar bot yang aktif",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner, isSubBot, botJid, senderJid }) => {
      const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const list = getSubBotsList();

      if (!list || list.length === 0) {
        return reply("ℹ️ Belum ada sub-bot yang aktif.\nGunakan *.addbot <nomor>* untuk menambahkan bot baru.");
      }

      // Jika yang meminta adalah Owner SubBot (bukan SuperOwner), hanya tampilkan bot yang dia miliki
      const filteredList = isPrimarySuperOwner
        ? list
        : list.filter((b) => {
            const bJid = `${b.number}@s.whatsapp.net`;
            return db.isBotOwner(bJid, senderJid);
          });

      if (filteredList.length === 0) {
        return reply("ℹ️ Tidak ada sub-bot yang terdaftar atas kepemilikan nomor Anda.");
      }

      const lines = [
        `🤖 *Daftar Bot Aktif (${filteredList.length})*\n`
      ];

      for (let i = 0; i < filteredList.length; i++) {
        const b = filteredList[i];
        const statusEmoji = b.status === "online" ? "🟢 Online" : b.status === "connecting" ? "🟡 Menghubungkan" : "🔴 " + b.status;
        const bJid = `${b.number}@s.whatsapp.net`;
        const bSettings = db.getBotSettings(bJid);
        const ownerNum = bSettings.ownerNumber ? bSettings.ownerNumber.split("@")[0] : b.number;
        const mode = bSettings.public === false ? "🔒 Self" : "🌐 Public";

        lines.push(`*${i + 1}. +${b.number}*`);
        lines.push(`   • Status: ${statusEmoji} | Mode: ${mode}`);
        lines.push(`   • Owner: +${ownerNum} | Prefix: \`${bSettings.prefix || "."}\``);
        lines.push(`   • Uptime: ${Math.floor(b.uptime / 60)} menit\n`);
      }

      lines.push(`_Gunakan \`.delbot <nomor>\` untuk mematikan dan menghapus bot._`);
      reply(lines.join("\n"));
    }
  },
  {
    name: "delbot",
    aliases: ["stopbot", "removebot"],
    description: "Hentikan dan hapus sub-bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner, senderJid }) => {
      const target = args[0]?.replace(/[^0-9]/g, "");
      if (!target) return reply("❌ Masukkan nomor bot yang ingin dihapus! Contoh: *.delbot 628xxx*");

      const targetJid = `${target}@s.whatsapp.net`;

      // Jika bukan SuperOwner utama, verifikasi bahwa pemanggil adalah owner dari bot target tersebut
      if (!isPrimarySuperOwner) {
        const isOwnerOfTarget = db.isBotOwner(targetJid, senderJid);
        if (!isOwnerOfTarget) {
          return reply("❌ Anda hanya dapat mematikan dan menghapus bot milik Anda sendiri!");
        }
      }

      try {
        const { stopSubBot } = await import("@/src/services/subbot/subbot.js");
        await stopSubBot(target);
        reply(`✅ Sub-bot *+${target}* berhasil dimatikan dan dihapus dari sesi.`);
      } catch (err) {
        reply(`❌ Gagal menghapus sub-bot: ${err.message}`);
      }
    }
  },
  {
    name: "syncsubbot",
    aliases: ["updatesubbot", "syncbot"],
    description: "Perbarui dan sinkronkan database serta pengaturan seluruh sub-bot yang ada di server",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Fitur sinkronisasi server hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const { syncSubBotsDatabase, getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const count = await syncSubBotsDatabase();
      const activeList = getSubBotsList();
      await reply(
        `✅ *Sinkronisasi Database Sub-Bot Berhasil!*\n\n` +
        `📦 *Sub-Bot di Server:* ${count} bot disinkronkan\n` +
        `🟢 *Status Aktif:* ${activeList.filter((b) => b.status === "online").length} online / ${activeList.length} total\n` +
        `⚙️ *Pengaturan:* Data & konfigurasi masing-masing sub-bot telah diperbarui tanpa bentrok peran.`
      );
    }
  },
  {
    name: "botstatus",
    aliases: ["statsbot", "systemstatus"],
    description: "Cek status kesehatan dan penggunaan memori bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      const mem = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);
      const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(1);

      const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const activeSubBots = getSubBotsList().length;

      const text =
        `⚙️ *Status Sistem*\n\n` +
        `• Uptime: ${hours}j ${minutes}m ${seconds}s\n` +
        `• RAM RSS: ${rssMB} MB\n` +
        `• Heap: ${heapUsedMB} MB / ${heapTotalMB} MB\n` +
        `• Primary Bot: 🟢 Online\n` +
        `• Sub-Bot Aktif: ${activeSubBots} bot\n` +
        `• Node.js: ${process.version}`;
      reply(text);
    }
  },
  {
    name: "vps",
    aliases: ["cekvps", "vpsstatus", "serverinfo"],
    description: "Cek spesifikasi dan kondisi server VPS (CPU, RAM, Disk, OS, Uptime)",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Informasi status server VPS hanya dapat diakses oleh SuperOwner.");
      }
      await sendTyping();

      const os = await import("os");
      const { exec } = await import("child_process");

      const cpus = os.cpus() || [];
      const cpuModel = cpus[0]?.model || "Unknown CPU";
      const cpuCores = cpus.length;

      const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
      const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

      const sysUptimeSec = Math.floor(os.uptime());
      const sysDays = Math.floor(sysUptimeSec / 86400);
      const sysHours = Math.floor((sysUptimeSec % 86400) / 3600);
      const sysMinutes = Math.floor((sysUptimeSec % 3600) / 60);

      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();

      exec("df -h / | awk 'NR==2 {print $2,$3,$4,$5}'", (err, stdout) => {
        let diskText = "Tidak tersedia";
        if (!err && stdout.trim()) {
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 4) {
            diskText = `${parts[1]} / ${parts[0]} (${parts[3]})`;
          }
        }

        const text =
          `🖥️ *Informasi Server VPS*\n\n` +
          `• OS: ${platform} ${arch} (${release})\n` +
          `• Uptime: ${sysDays}h ${sysHours}j ${sysMinutes}m\n` +
          `• CPU: ${cpuModel} (${cpuCores} Core)\n` +
          `• RAM: ${usedMem} GB / ${totalMem} GB (${memPercent}%)\n` +
          `• Disk (/): ${diskText}\n` +
          `• Node.js: ${process.version}`;

        reply(text);
      });
    }
  },
  {
    name: "cleartmp",
    aliases: ["clearsampah", "clearcache", "purgetmp"],
    description: "Bersihkan file sampah, cache sesi usang, dan log sementara",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, logger, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pembersihan cache dan sampah server hanya dapat dijalankan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      await reply("🧹 Sedang membersihkan file sampah dan cache sementara...");
      try {
        const { clearAllCache } = await import("@/src/utils/cleaner.js");
        const { deletedCount, freedBytes } = clearAllCache({ logger });
        const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
        await reply(
          `✅ *Pembersihan Semua Cache & Sampah Selesai!*\n\n` +
          `🗑️ *File dihapus:* ${deletedCount} file (cache, temp, dump, session keys)\n` +
          `💾 *Ruang dibebaskan:* ${freedMB} MB\n` +
          `⚡ *Renderer Chrome:* Dibersihkan (orphaned process killed)`
        );
      } catch (err) {
        await reply(`❌ Gagal membersihkan sampah: ${err.message}`);
      }
    }
  },
  {
    name: "setch",
    aliases: ["setsaluran", "setchannel"],
    description: "Atur ID/link saluran (newsletter) resmi bot untuk posting struk/update",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan saluran resmi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const input = args[0]?.trim();
      if (!input) {
        const cur = db.getSettings();
        return reply(
          `📢 *Manajemen Saluran*\n\n` +
          `• Saluran saat ini: *${cur.channelJid || "Belum diatur"}*\n` +
          `• Nama saluran: *${cur.channelName || "Official Channel"}*\n` +
          `• Auto post trx: *${cur.autoForwardTrxToChannel !== false ? "Aktif" : "Mati"}*\n\n` +
          `*Cara Mengatur:*\n` +
          `• \`.setch <JID_SALURAN>\`\n` +
          `  Contoh: \`.setch 120363312345678901@newsletter\`\n` +
          `• Link saluran: \`.setch https://whatsapp.com/channel/0029Vxxxxxxx\`\n` +
          `• Ganti nama saluran: \`.setch name <Nama Baru>\``
        );
      }

      if (input.toLowerCase() === "name" || input.toLowerCase() === "nama") {
        const newName = args.slice(1).join(" ").trim();
        if (!newName) return reply("❌ Masukkan nama baru untuk saluran!");
        db.updateSettings({ channelName: newName });
        return reply(`✅ Nama saluran bot berhasil diubah menjadi: *${newName}*`);
      }

      let channelJid = input;
      // Jika input adalah link saluran whatsapp (whatsapp.com/channel/xxx)
      if (input.includes("whatsapp.com/channel/")) {
        const code = input.split("whatsapp.com/channel/")[1]?.split(/[\/\?\s]/)[0];
        if (code && sock.newsletterMetadata) {
          try {
            const meta = await sock.newsletterMetadata("invite", code);
            if (meta?.id) {
              channelJid = meta.id;
            }
          } catch (e) {
            // Biarkan lanjut atau beri tahu
          }
        }
      }

      if (!channelJid.includes("@newsletter")) {
        // Cek jika hanya angka ID
        if (/^\d{15,20}$/.test(channelJid)) {
          channelJid = `${channelJid}@newsletter`;
        } else {
          return reply(
            `❌ Format ID Saluran tidak valid!\n` +
            `ID Saluran WhatsApp harus berakhiran *@newsletter* atau berupa link saluran resmi.\n` +
            `Contoh: \`.setch 120363312345678901@newsletter\``
          );
        }
      }

      db.updateSettings({ channelJid });
      reply(
        `✅ *Saluran Berhasil Diatur!*\n\n` +
        `📢 *JID Saluran:* \`${channelJid}\`\n` +
        `⚡ *Auto-Forward TRX:* Otomatis aktif. Setiap transaksi atau orderan baru akan dikirimkan ke saluran ini.`
      );
    },
  },
  {
    name: "delch",
    aliases: ["clearch", "hapussaluran"],
    description: "Hapus konfigurasi saluran resmi dari bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan saluran resmi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      db.updateSettings({ channelJid: "" });
      reply("✅ Konfigurasi Saluran bot berhasil dinonaktifkan/dihapus.");
    },
  },
  {
    name: "autotrxch",
    aliases: ["autochtrx", "trxchannel"],
    description: "Aktifkan atau nonaktifkan auto forward transaksi ke saluran (on/off)",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan auto forward transaksi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      const mode = args[0]?.toLowerCase();
      if (!mode || !["on", "off", "aktif", "mati"].includes(mode)) {
        const cur = db.getSettings();
        return reply(
          `ℹ️ Status Auto Post TRX ke Saluran saat ini: *${cur.autoForwardTrxToChannel !== false ? "AKTIF (ON)" : "NONAKTIF (OFF)"}*\n\n` +
          `Gunakan: \`.autotrxch on\` atau \`.autotrxch off\``
        );
      }

      const enabled = mode === "on" || mode === "aktif";
      db.updateSettings({ autoForwardTrxToChannel: enabled });
      reply(`✅ Auto-post transaksi ke Saluran sekarang: *${enabled ? "AKTIF (ON)" : "NONAKTIF (OFF)"}*.`);
    },
  },
  {
    name: "postch",
    aliases: ["postsaluran", "chpost"],
    description: "Kirim pesan / pengumuman manual dari bot langsung ke saluran resmi",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, quoted, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Posting ke saluran resmi hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const settings = db.getSettings();
      const channelJid = settings.channelJid;

      if (!channelJid || !channelJid.includes("@newsletter")) {
        return reply("❌ Saluran belum diatur! Gunakan perintah *.setch <JID_SALURAN>* terlebih dahulu.");
      }

      const content = args.join(" ").trim();
      if (!content && !quoted) {
        return reply("❌ Masukkan teks pesan yang ingin dipost ke saluran! Atau reply gambar/media.");
      }

      try {
        if (quoted && /image/i.test(quoted.mtype || "")) {
          const media = await quoted.download();
          await sock.sendMessage(channelJid, {
            image: media,
            caption: content || quoted.text || "",
          });
        } else {
          await sock.sendMessage(channelJid, {
            text: content,
          });
        }
        reply(`✅ Pesan berhasil diposting ke Saluran (*${settings.channelName || channelJid}*)!`);
      } catch (err) {
        reply(`❌ Gagal mengirim pesan ke saluran: ${err.message}`);
      }
    },
  },
  {
    name: "infoch",
    aliases: ["chinfo", "saluraninfo"],
    description: "Cek informasi saluran yang terhubung dengan bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const settings = db.getSettings();
      const channelJid = settings.channelJid;

      if (!channelJid) {
        return reply(
          `📢 *Informasi Saluran*\n\n` +
          `Status: 🔴 Belum terhubung\n\n` +
          `Gunakan \`.setch <JID_SALURAN>\` untuk menghubungkan bot ke saluran.`
        );
      }

      let infoText =
        `📢 *Informasi Saluran*\n\n` +
        `• JID Saluran: \`${channelJid}\`\n` +
        `• Nama Label: *${settings.channelName || "Official Channel"}*\n` +
        `• Auto Post TRX: *${settings.autoForwardTrxToChannel !== false ? "Aktif" : "Mati"}*\n`;

      try {
        if (sock.newsletterMetadata) {
          const meta = await sock.newsletterMetadata("jid", channelJid);
          if (meta) {
            infoText += `• Nama Asli Saluran: *${meta.name || "-"}*\n`;
            infoText += `• Subscribers: *${meta.subscribers || "-"}*\n`;
            infoText += `• Dibuat: *${meta.creation_time ? new Date(meta.creation_time * 1000).toLocaleDateString("id-ID") : "-"}*\n`;
          }
        }
      } catch (_) {}

      infoText += `\n_Gunakan \`.postch <pesan>\` untuk posting atau \`.delch\` untuk melepas._`;

      reply(infoText);
    },
  },
  {
    name: "restart",
    aliases: ["reboot"],
    description: "Restart proses bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Restart proses server hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      await reply("🔄 Merestart bot... Mohon tunggu beberapa saat.");
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
  }
];
