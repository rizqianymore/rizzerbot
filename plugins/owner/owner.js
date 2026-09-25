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
    name: "addprem",
    description: "Add premium user",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.addprem 628xx*");
      db.getUser(jid).premium = true;
      db.save();
      reply(`✅ Berhasil menambahkan *${jid.split("@")[0]}* ke Premium.`);
    }
  },
  {
    name: "delprem",
    description: "Remove premium user",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, getTargetJid }) => {
      const jid = getTargetJid(args);
      if (!jid) return reply("❌ Balas pesan user atau masukkan nomor! Contoh: *.delprem 628xx*");
      db.getUser(jid).premium = false;
      db.save();
      reply(`✅ Berhasil menghapus *${jid.split("@")[0]}* dari Premium.`);
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
      if (!args[0]) return reply("Masukkan prefix baru!");
      db.data.settings.prefix = args[0];
      db.save();
      reply(`✅ Prefix berhasil diubah ke: ${args[0]}`);
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
      await sock.updateBlockStatus(jid, "block");
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
      const targetUser = db.getUser(jid);
      targetUser.banned = false;
      db.save();
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
      db.data.settings.public = false;
      db.save();
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
      db.data.settings.public = true;
      db.save();
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
