import { db } from "@/src/core/database.js";
import { getCachedGroupMeta, invalidateGroupMeta } from "@/src/utils/helper.js";
import { settings } from "@/config/settings.js";

/**
 * Validates group context and checks bot/user admin permissions.
 */
async function getGroupContext(sock, msg, context, { requireUserAdmin = true, requireBotAdmin = false } = {}) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || !remoteJid.endsWith("@g.us")) {
    await context.reply("❌ Perintah ini hanya dapat digunakan di dalam grup!");
    return null;
  }

  const meta = (await getCachedGroupMeta(sock, remoteJid)) || (await sock.groupMetadata(remoteJid).catch(() => null));
  if (!meta || !Array.isArray(meta.participants)) {
    await context.reply("❌ Gagal mengambil informasi grup WhatsApp.");
    return null;
  }

  const senderJid = context.senderJid;
  const botJid = db.normalizeJid(sock.user?.id);

  const botParticipant = meta.participants.find((p) => db.normalizeJid(p.id) === botJid);
  const isBotAdmin = Boolean(
    botParticipant && (botParticipant.admin === "admin" || botParticipant.admin === "superadmin")
  );

  const userParticipant = meta.participants.find((p) => db.normalizeJid(p.id) === senderJid);
  const isUserAdmin = Boolean(
    context.isOwner || (userParticipant && (userParticipant.admin === "admin" || userParticipant.admin === "superadmin"))
  );

  if (requireUserAdmin && !isUserAdmin) {
    await context.reply("❌ Fitur ini hanya untuk Admin Grup atau Owner Bot!");
    return null;
  }

  if (requireBotAdmin && !isBotAdmin) {
    await context.reply("❌ Jadikan bot sebagai Admin grup terlebih dahulu untuk menggunakan fitur ini!");
    return null;
  }

  return {
    remoteJid,
    meta,
    participants: meta.participants,
    isBotAdmin,
    isUserAdmin,
  };
}

export default [
  {
    name: "hidetag",
    aliases: ["ht"],
    description: "Mention semua member grup secara senyap/transparan",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, { requireUserAdmin: true });
      if (!ctx) return;

      const mentions = ctx.participants.map((p) => p.id);
      let text = args.join(" ");

      // Jika user membalas pesan orang lain tanpa mengetik teks tambahan, gunakan teks pesan yang dibalas
      if (!text && context.quoted) {
        text =
          context.quoted.conversation ||
          context.quoted.extendedTextMessage?.text ||
          context.quoted.imageMessage?.caption ||
          context.quoted.videoMessage?.caption ||
          "";
      }

      if (!text) {
        text = "📢 Perhatian semua member!";
      }

      await sock.sendMessage(
        ctx.remoteJid,
        { text, mentions },
        { quoted: msg }
      );
    },
  },
  {
    name: "tagall",
    aliases: ["totag"],
    description: "Mention semua member grup dengan daftar teks",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, { requireUserAdmin: true });
      if (!ctx) return;

      const mentions = ctx.participants.map((p) => p.id);
      const customMessage = args.join(" ") || "Halo semuanya!";

      let text = `📢 *TAG ALL - ${ctx.meta.subject}*\n`;
      text += `📝 *Pesan:* ${customMessage}\n`;
      text += `👥 *Total Member:* ${mentions.length}\n\n`;

      ctx.participants.forEach((p, index) => {
        const num = p.id.split("@")[0];
        const role = p.admin ? (p.admin === "superadmin" ? " 👑 (Creator)" : " ⭐ (Admin)") : "";
        text += `${index + 1}. @${num}${role}\n`;
      });

      await sock.sendMessage(
        ctx.remoteJid,
        { text: text.trim(), mentions },
        { quoted: msg }
      );
    },
  },
  {
    name: "kick",
    aliases: ["tendang", "remove"],
    description: "Mengeluarkan member dari grup",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const targetJid = context.getTargetJid(args);
      if (!targetJid) {
        return context.reply("❌ Balas pesan member yang ingin di-kick atau ketik nomornya! Contoh: *.kick @user* atau *.kick 628xxx*");
      }

      const botJid = db.normalizeJid(sock.user?.id);
      if (db.normalizeJid(targetJid) === botJid) {
        return context.reply("❌ Bot tidak bisa meng-kick diri sendiri!");
      }

      // Lindungi owner bot
      const ownerJids = [settings.ownerNumber, settings.pairingNumber].map(
        (v) => db.normalizeJid(v)
      );
      if (ownerJids.includes(db.normalizeJid(targetJid))) {
        return context.reply("❌ Tidak dapat mengeluarkan Owner Bot dari grup!");
      }

      try {
        await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "remove");
        invalidateGroupMeta(ctx.remoteJid);
        await sock.sendMessage(
          ctx.remoteJid,
          {
            text: `👋 Berhasil mengeluarkan @${targetJid.split("@")[0]} dari grup.`,
            mentions: [targetJid],
          },
          { quoted: msg }
        );
      } catch (err) {
        await context.reply(`❌ Gagal mengeluarkan member: ${err.message}`);
      }
    },
  },
  {
    name: "add",
    aliases: ["tambah", "invite"],
    description: "Menambahkan / mengundang member ke grup",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const targetJid = context.getTargetJid(args);
      if (!targetJid) {
        return context.reply("❌ Masukkan nomor WhatsApp yang ingin ditambahkan! Contoh: *.add 62812345678*");
      }

      try {
        const response = await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "add");
        invalidateGroupMeta(ctx.remoteJid);

        const status = response?.[0]?.status;
        if (status === "403" || status === "408") {
          // User mengatur privasi grup ke 'Kontak Saya'
          const code = await sock.groupInviteCode(ctx.remoteJid);
          const inviteUrl = `https://chat.whatsapp.com/${code}`;
          await context.reply(
            `⚠️ Tidak dapat menambahkan @${targetJid.split("@")[0]} secara langsung karena pengaturan privasinya.\n\nSilakan bagikan link undangan ini ke user:\n🔗 ${inviteUrl}`
          );
        } else if (status === "409") {
          await context.reply(`ℹ️ User @${targetJid.split("@")[0]} sudah berada di dalam grup.`);
        } else {
          await sock.sendMessage(
            ctx.remoteJid,
            {
              text: `✅ Berhasil menambahkan @${targetJid.split("@")[0]} ke dalam grup.`,
              mentions: [targetJid],
            },
            { quoted: msg }
          );
        }
      } catch (err) {
        await context.reply(`❌ Gagal menambahkan member: ${err.message}`);
      }
    },
  },
  {
    name: "promote",
    aliases: ["naikadmin"],
    description: "Menaikkan member menjadi admin grup",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const targetJid = context.getTargetJid(args);
      if (!targetJid) {
        return context.reply("❌ Balas pesan member atau masukkan nomor yang ingin dinaikkan jadi admin!");
      }

      try {
        await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "promote");
        invalidateGroupMeta(ctx.remoteJid);
        await sock.sendMessage(
          ctx.remoteJid,
          {
            text: `👑 Selamat! @${targetJid.split("@")[0]} sekarang telah menjadi Admin grup.`,
            mentions: [targetJid],
          },
          { quoted: msg }
        );
      } catch (err) {
        await context.reply(`❌ Gagal menaikkan admin: ${err.message}`);
      }
    },
  },
  {
    name: "demote",
    aliases: ["turunadmin"],
    description: "Menurunkan jabatan admin grup menjadi member biasa",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const targetJid = context.getTargetJid(args);
      if (!targetJid) {
        return context.reply("❌ Balas pesan admin atau masukkan nomor yang ingin dicabut status adminnya!");
      }

      try {
        await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "demote");
        invalidateGroupMeta(ctx.remoteJid);
        await sock.sendMessage(
          ctx.remoteJid,
          {
            text: `🔻 Status admin untuk @${targetJid.split("@")[0]} telah dicabut.`,
            mentions: [targetJid],
          },
          { quoted: msg }
        );
      } catch (err) {
        await context.reply(`❌ Gagal menurunkan admin: ${err.message}`);
      }
    },
  },
  {
    name: "group",
    aliases: ["grup"],
    description: "Buka atau tutup grup (chatting semua member / hanya admin)",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const action = (args[0] || "").toLowerCase();
      if (action === "open" || action === "buka") {
        await sock.groupSettingUpdate(ctx.remoteJid, "not_announcement");
        await context.reply("🔓 *Grup berhasil dibuka!* Semua member sekarang dapat mengirim pesan.");
      } else if (action === "close" || action === "tutup") {
        await sock.groupSettingUpdate(ctx.remoteJid, "announcement");
        await context.reply("🔒 *Grup berhasil ditutup!* Hanya admin yang dapat mengirim pesan.");
      } else {
        await context.reply("❌ Perintah tidak valid! Gunakan: *.group open* (buka grup) atau *.group close* (tutup grup)");
      }
    },
  },
  {
    name: "linkgroup",
    aliases: ["linkgc", "linkgrup"],
    description: "Mengambil link undangan grup WhatsApp",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: false,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      try {
        const code = await sock.groupInviteCode(ctx.remoteJid);
        const link = `https://chat.whatsapp.com/${code}`;
        await context.reply(`🔗 *Link Undangan Grup ${ctx.meta.subject}:*\n${link}`);
      } catch (err) {
        await context.reply(`❌ Gagal mengambil link grup: ${err.message}`);
      }
    },
  },
  {
    name: "revoke",
    aliases: ["resetlink", "revokelink"],
    description: "Mereset link undangan grup dan membuat link baru",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      try {
        const newCode = await sock.groupRevokeInvite(ctx.remoteJid);
        const newLink = `https://chat.whatsapp.com/${newCode}`;
        await context.reply(`🔄 *Link undangan grup berhasil di-reset!*\n\nLink baru:\n🔗 ${newLink}`);
      } catch (err) {
        await context.reply(`❌ Gagal mereset link grup: ${err.message}`);
      }
    },
  },
  {
    name: "setname",
    aliases: ["setsubject", "namagc"],
    description: "Mengubah nama atau subjek grup",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const newName = args.join(" ").trim();
      if (!newName) {
        return context.reply("❌ Masukkan nama baru untuk grup! Contoh: *.setname Rizzer Community*");
      }
      if (newName.length > 100) {
        return context.reply("❌ Nama grup maksimal 100 karakter!");
      }

      try {
        await sock.groupUpdateSubject(ctx.remoteJid, newName);
        invalidateGroupMeta(ctx.remoteJid);
        await context.reply(`✅ Nama grup berhasil diubah menjadi: *${newName}*`);
      } catch (err) {
        await context.reply(`❌ Gagal mengubah nama grup: ${err.message}`);
      }
    },
  },
  {
    name: "setdesc",
    aliases: ["setdeskripsi", "descgc"],
    description: "Mengubah deskripsi grup",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: true,
        requireBotAdmin: true,
      });
      if (!ctx) return;

      const newDesc = args.join(" ").trim();
      if (!newDesc) {
        return context.reply("❌ Masukkan deskripsi baru untuk grup! Contoh: *.setdesc Grup diskusi seputar teknologi & bot WhatsApp*");
      }

      try {
        await sock.groupUpdateDescription(ctx.remoteJid, newDesc);
        invalidateGroupMeta(ctx.remoteJid);
        await context.reply("✅ Deskripsi grup berhasil diperbarui!");
      } catch (err) {
        await context.reply(`❌ Gagal mengubah deskripsi grup: ${err.message}`);
      }
    },
  },
  {
    name: "infogrup",
    aliases: ["gcinfo", "groupinfo"],
    description: "Menampilkan informasi detail grup WhatsApp saat ini",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: false,
        requireBotAdmin: false,
      });
      if (!ctx) return;

      const meta = ctx.meta;
      const totalMembers = ctx.participants.length;
      const adminCount = ctx.participants.filter((p) => p.admin).length;
      const creator = meta.owner ? `@${meta.owner.split("@")[0]}` : "-";
      const creationDate = meta.creation
        ? new Date(meta.creation * 1000).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        : "-";

      let text = `📋 *INFORMASI GRUP*\n\n`;
      text += `📌 *Nama Grup:* ${meta.subject}\n`;
      text += `🆔 *ID Grup:* ${meta.id}\n`;
      text += `👑 *Pembuat Grup:* ${creator}\n`;
      text += `📅 *Dibuat Pada:* ${creationDate}\n`;
      text += `👥 *Total Member:* ${totalMembers}\n`;
      text += `⭐ *Jumlah Admin:* ${adminCount}\n`;
      text += `🔒 *Izin Kirim Pesan:* ${meta.announce ? "Hanya Admin" : "Semua Member"}\n`;
      text += `✏️ *Izin Edit Info:* ${meta.restrict ? "Hanya Admin" : "Semua Member"}\n\n`;
      text += `📝 *Deskripsi Grup:*\n${meta.desc || "(Tidak ada deskripsi)"}`;

      const mentions = meta.owner ? [meta.owner] : [];

      try {
        const ppUrl = await sock.profilePictureUrl(ctx.remoteJid, "image").catch(() => null);
        if (ppUrl) {
          await sock.sendMessage(
            ctx.remoteJid,
            { image: { url: ppUrl }, caption: text, mentions },
            { quoted: msg }
          );
          return;
        }
      } catch (_) { }

      await sock.sendMessage(
        ctx.remoteJid,
        { text, mentions },
        { quoted: msg }
      );
    },
  },
  {
    name: "listadmin",
    aliases: ["adminlist", "admins"],
    description: "Menampilkan daftar seluruh admin grup saat ini",
    category: "Group",
    run: async (sock, msg, args, context) => {
      await context.sendTyping();
      const ctx = await getGroupContext(sock, msg, context, {
        requireUserAdmin: false,
        requireBotAdmin: false,
      });
      if (!ctx) return;

      const admins = ctx.participants.filter((p) => p.admin);
      if (!admins.length) {
        return context.reply("❌ Tidak ditemukan admin di grup ini.");
      }

      const creator = admins.find((p) => p.admin === "superadmin");
      const regularAdmins = admins.filter((p) => p.admin !== "superadmin");

      let text = `👑 *DAFTAR ADMIN GRUP*\n`;
      text += `📌 *Grup:* ${ctx.meta.subject}\n`;
      text += `👥 *Total Admin:* ${admins.length}\n\n`;

      if (creator) {
        text += `👑 *Creator / Pembuat Grup:*\n• @${creator.id.split("@")[0]}\n\n`;
      }

      if (regularAdmins.length > 0) {
        text += `⭐ *Admin:*\n`;
        regularAdmins.forEach((a, i) => {
          text += `${i + 1}. @${a.id.split("@")[0]}\n`;
        });
      }

      const mentions = admins.map((a) => a.id);
      await sock.sendMessage(
        ctx.remoteJid,
        { text: text.trim(), mentions },
        { quoted: msg }
      );
    },
  },
];
