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
      reply(`✅ *${jid.split("@")[0]}* dibuka blokirnya.`);
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
  }
];
