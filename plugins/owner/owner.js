import { db } from '@/src/core/database.js';

export default [
  {
    name: "eval",
    description: "Evaluate javascript code",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
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
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addowner 628xx*");
      if (db.isOwner(jid)) return reply(`ℹ️ *${jid.split("@")[0]}* sudah menjadi Owner.`);

      db.setOwner(jid, true);
      reply(`👑 Berhasil menambahkan *${jid.split("@")[0]}* sebagai Owner Bot.`);
    }
  },
  {
    name: "delowner",
    description: "Hapus owner tambahan dari bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delowner 628xx*");
      if (db.isPrimaryOwner(jid)) {
        return reply("❌ Nomor tersebut adalah Primary Owner (Pemilik Utama) dan tidak dapat dihapus!");
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
    run: async (sock, msg, args, { reply }) => {
      const settings = db.getSettings();
      const primary = db.normalizeJid(settings.ownerNumber);
      const ownerList = [
        primary,
        ...(Array.isArray(settings.ownerNumbers) ? settings.ownerNumbers : []),
      ].filter(Boolean);
      const uniqueOwners = [...new Set(ownerList.map(j => db.normalizeJid(j)))];

      let text = `👑 *DAFTAR OWNER BOT*\n─────────────────────────\n`;
      uniqueOwners.forEach((j, i) => {
        const num = j.split("@")[0];
        const isMain = j === primary;
        text += `${i + 1}. +${num} ${isMain ? "⭐ _(Primary Owner)_" : "👑 _(Owner)_"}\n`;
      });
      text += `─────────────────────────\nTotal: ${uniqueOwners.length} Owner`;
      reply(text);
    }
  },
  {
    name: "addadmin",
    description: "Tambahkan admin bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
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
    run: async (sock, msg, args, { reply, getTargetJid }) => {
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

      let text = `🛡️ *DAFTAR ADMIN BOT*\n─────────────────────────\n`;
      uniqueAdmins.forEach((j, i) => {
        const num = j.split("@")[0];
        text += `${i + 1}. +${num}\n`;
      });
      text += `─────────────────────────\nTotal: ${uniqueAdmins.length} Admin`;
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

      let text = `⭐ *DAFTAR PENGGUNA PREMIUM*\n─────────────────────────\n`;
      allPrems.forEach((u, i) => {
        const num = u.jid.split("@")[0];
        const status = u.isPermanent ? "Permanen" : `Hingga ${new Date(u.premiumUntil).toLocaleDateString("id-ID")}`;
        text += `${i + 1}. +${num} _(${status})_\n`;
      });
      text += `─────────────────────────\nTotal: ${allPrems.length} Premium`;
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
        await sock.sendMessage(jid, { text: `*--- BROADCAST ---*\n\n${args.join(" ")}` });
      }
      reply(`✅ Broadcast terkirim ke ${chats.length} grup.`);
    }
  },
  {
    name: "setprefix",
    description: "Change bot prefix",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      const prefix = args[0] || "";
      if (!prefix || prefix.length > 3 || /\s/.test(prefix)) {
        return reply("❌ Prefix harus berupa 1-3 karakter tanpa spasi.");
      }
      db.updateSettings({ prefix });
      reply(`✅ Prefix berhasil diubah ke: ${prefix}`);
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
    description: "Set bot to self mode (owner only)",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      db.updateSettings({ public: false });
      reply("✅ Bot sekarang dalam mode Self (hanya owner).");
    }
  },
  {
    name: "public",
    aliases: ["pub"],
    description: "Set bot to public mode",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      db.updateSettings({ public: true });
      reply("✅ Bot sekarang dalam mode Public (semua user).");
    }
  },
  {
    name: "addbot",
    aliases: ["jadibot", "pairbot"],
    description: "Tambahkan bot baru (sub-bot) via pairing code",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const number = args[0]?.replace(/[^0-9]/g, "");
      if (!number || number.length < 8) {
        return reply("❌ Masukkan nomor WhatsApp untuk dijadikan bot! Contoh: *.addbot 6281234567890*");
      }

      await reply(`⏳ Menyiapkan sesi bot untuk *${number}*...\nKode pairing akan dikirimkan sebentar lagi.`);

      try {
        const { createSubBot } = await import("@/src/services/subbot/subbot.js");
        await createSubBot(number, async (code) => {
          const message =
            `🔑 *KODE PAIRING BOT BARU*\n\n` +
            `Nomor: *${number}*\n` +
            `Kode Pairing: *\`${code}\`*\n\n` +
            `_Buka WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon, lalu masukkan kode di atas._`;
          await reply(message);
        });
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
    run: async (sock, msg, args, { reply }) => {
      const { getSubBotsList } = await import("@/src/services/subbot/subbot.js");
      const list = getSubBotsList();

      if (!list || list.length === 0) {
        return reply("ℹ️ Belum ada sub-bot yang aktif.\nGunakan *.addbot <nomor>* untuk menambahkan bot baru.");
      }

      const lines = [
        `🤖 *DAFTAR BOT AKTIF (${list.length})*`,
        `─────────────────────────`
      ];

      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const statusEmoji = b.status === "online" ? "🟢 Online" : b.status === "connecting" ? "🟡 Menghubungkan" : "🔴 " + b.status;
        lines.push(`*${i + 1}. +${b.number}*`);
        lines.push(`   • Status: ${statusEmoji}`);
        lines.push(`   • Uptime: ${Math.floor(b.uptime / 60)} menit`);
        lines.push("");
      }

      lines.push(`💡 _Gunakan \`.delbot <nomor>\` untuk mematikan dan menghapus bot._`);
      reply(lines.join("\n"));
    }
  },
  {
    name: "delbot",
    aliases: ["stopbot", "removebot"],
    description: "Hentikan dan hapus sub-bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      const target = args[0]?.replace(/[^0-9]/g, "");
      if (!target) return reply("❌ Masukkan nomor bot yang ingin dihapus! Contoh: *.delbot 628xxx*");

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
        `⚙️ *STATUS SISTEM & MANAJEMEN BOT*\n` +
        `─────────────────────────\n` +
        `⏱️ *Uptime:* ${hours}j ${minutes}m ${seconds}s\n` +
        `💾 *RAM RSS:* ${rssMB} MB\n` +
        `🧠 *Heap:* ${heapUsedMB} MB / ${heapTotalMB} MB\n` +
        `🤖 *Primary Bot:* 🟢 Online\n` +
        `👥 *Active Sub-Bots:* ${activeSubBots} bot\n` +
        `⚡ *Node.js:* ${process.version}\n` +
        `─────────────────────────`;
      reply(text);
    }
  },
  {
    name: "cleartmp",
    aliases: ["clearsampah", "clearcache", "purgetmp"],
    description: "Bersihkan file sampah, cache sesi usang, dan log sementara",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping, logger }) => {
      await sendTyping();
      await reply("🧹 Sedang membersihkan file sampah dan cache sementara...");
      try {
        const { cleanTempFiles, cleanOrphanChromeProcesses } = await import("@/src/utils/cleaner.js");
        cleanOrphanChromeProcesses(logger);
        const { deletedCount, freedBytes } = cleanTempFiles();
        const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
        await reply(
          `✅ *Pembersihan Sampah Selesai!*\n\n` +
          `🗑️ *File dihapus:* ${deletedCount} file\n` +
          `💾 *Ruang dibebaskan:* ${freedMB} MB\n` +
          `⚡ *Renderer Chrome:* Dibersihkan (orphaned process killed)`
        );
      } catch (err) {
        await reply(`❌ Gagal membersihkan sampah: ${err.message}`);
      }
    }
  },
  {
    name: "restart",
    aliases: ["reboot"],
    description: "Restart proses bot",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply }) => {
      await reply("🔄 Merestart bot... Mohon tunggu beberapa saat.");
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
  }
];
