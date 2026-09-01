import { getCachedGroupMeta } from "@/src/utils/helper.js";

async function verifyGroupAndAdmin(sock, msg, senderJid, isOwner) {
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid.endsWith("@g.us")) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Perintah ini hanya dapat digunakan di dalam grup!" },
      { quoted: msg }
    );
    return null;
  }

  const groupMeta = await getCachedGroupMeta(sock, remoteJid);
  if (!groupMeta) {
    await sock.sendMessage(
      remoteJid,
      { text: "❌ Gagal memuat metadata grup." },
      { quoted: msg }
    );
    return null;
  }

  const participants = groupMeta.participants || [];
  const sender = participants.find(
    (p) => p.id.replace(/:.*@/, "@") === senderJid.replace(/:.*@/, "@")
  );
  const isSenderAdmin =
    sender?.admin === "admin" || sender?.admin === "superadmin" || isOwner;

  if (!isSenderAdmin) {
    await sock.sendMessage(
      remoteJid,
      { text: "⚠️ Hanya admin grup atau owner bot yang dapat menggunakan perintah ini!" },
      { quoted: msg }
    );
    return null;
  }

  const botJid = sock.user.id.replace(/:.*@/, "@");
  const botParticipant = participants.find(
    (p) => p.id.replace(/:.*@/, "@") === botJid
  );
  const isBotAdmin =
    botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";

  return { remoteJid, participants, isBotAdmin };
}

export default [
  {
    name: "kick",
    description: "Mengeluarkan anggota dari grup.",
    usage: "<tag/balas/nomor>",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, getTargetJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      const target = getTargetJid(args);
      if (!target) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon target." },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        await sock.groupParticipantsUpdate(remoteJid, [target], "remove");
        await sock.sendMessage(
          remoteJid,
          {
            text: `✅ Berhasil mengeluarkan @${target.split("@")[0]}`,
            mentions: [target],
          },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal mengeluarkan anggota: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "promote",
    description: "Menaikkan jabatan anggota menjadi Admin Grup.",
    usage: "<tag/balas/nomor>",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, getTargetJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      const target = getTargetJid(args);
      if (!target) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon target." },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        await sock.groupParticipantsUpdate(remoteJid, [target], "promote");
        await sock.sendMessage(
          remoteJid,
          {
            text: `✅ @${target.split("@")[0]} sekarang telah menjadi Admin Grup!`,
            mentions: [target],
          },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal menaikkan jabatan admin: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "demote",
    description: "Menurunkan jabatan Admin Grup menjadi anggota biasa.",
    usage: "<tag/balas/nomor>",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, getTargetJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      const target = getTargetJid(args);
      if (!target) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Harap tag, balas pesan, atau masukkan nomor telepon target." },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        await sock.groupParticipantsUpdate(remoteJid, [target], "demote");
        await sock.sendMessage(
          remoteJid,
          {
            text: `✅ @${target.split("@")[0]} sekarang telah diturunkan menjadi anggota biasa.`,
            mentions: [target],
          },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal menurunkan jabatan admin: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "tagall",
    aliases: ["hidetag", "totag"],
    description: "Mention semua anggota grup secara bersamaan.",
    usage: "[pesan]",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, participants } = verified;
      const customMessage = args.join(" ") || "Panggilan penting!";

      await sendTyping();
      const mentions = participants.map((p) => p.id);
      const outputText = `📢 *Tag All Members*\n\n*Pesan:* ${customMessage}\n\n` + 
        participants.map((p) => `• @${p.id.split("@")[0]}`).join("\n");

      await sock.sendMessage(
        remoteJid,
        { text: outputText, mentions },
        { quoted: msg }
      );
    },
  },
  {
    name: "group",
    description: "Membuka atau menutup setelan kirim pesan grup.",
    usage: "<open/close>",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      const action = args[0]?.toLowerCase();
      if (action !== "open" && action !== "close") {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Harap tentukan setelan. Contoh: *.group open* atau *.group close*" },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        await sock.groupSettingUpdate(
          remoteJid,
          action === "open" ? "not_announcement" : "announcement"
        );
        await sock.sendMessage(
          remoteJid,
          { text: `✅ Berhasil ${action === "open" ? "membuka" : "menutup"} obrolan grup.` },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal merubah setelan grup: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "link",
    aliases: ["linkgroup", "linkgc"],
    description: "Mendapatkan link undangan grup.",
    usage: "",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        const inviteCode = await sock.groupInviteCode(remoteJid);
        const link = `https://chat.whatsapp.com/${inviteCode}`;
        await sock.sendMessage(
          remoteJid,
          { text: `🔗 *Link Undangan Grup*\n\n${link}` },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal mengambil link grup: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "revoke",
    aliases: ["revokelink", "resetlink"],
    description: "Mereset/mengubah link undangan grup.",
    usage: "",
    category: "Group",
    run: async (sock, msg, args, context) => {
      const { isOwner, senderJid, sendTyping } = context;
      const verified = await verifyGroupAndAdmin(sock, msg, senderJid, isOwner);
      if (!verified) return;

      const { remoteJid, isBotAdmin } = verified;
      if (!isBotAdmin) {
        await sock.sendMessage(
          remoteJid,
          { text: "⚠️ Bot harus menjadi admin grup terlebih dahulu!" },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      try {
        const newCode = await sock.groupRevokeInvite(remoteJid);
        const link = `https://chat.whatsapp.com/${newCode}`;
        await sock.sendMessage(
          remoteJid,
          { text: `✅ Berhasil mereset link undangan grup!\n\n🔗 *Link Baru:* ${link}` },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          remoteJid,
          { text: `❌ Gagal mereset link grup: ${err.message}` },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "lockgc",
    aliases: ["grouplock", "lockgroup"],
    description: "Mengaktifkan/menonaktifkan mode Group Lock atau mengizinkan grup ini.",
    usage: "<on/off/allow/del>",
    category: "Group",
    ownerOnly: true,
    run: async (sock, msg, args, context) => {
      const { sendTyping, activePrefix } = context;
      const remoteJid = msg.key.remoteJid;
      await sendTyping();

      const action = args[0]?.toLowerCase();
      const currentSettings = db.getSettings();

      if (!action) {
        const isLocked = currentSettings.groupLock;
        const allowed = currentSettings.allowedGroups || [];
        const isCurrentAllowed = allowed.includes(remoteJid);

        return sock.sendMessage(
          remoteJid,
          {
            text:
              `🔐 *Group Lock System*\n\n` +
              `• Status Lock Global: *${isLocked ? "AKTIF" : "NONAKTIF"}*\n` +
              `• Grup Ini Diizinkan: *${isCurrentAllowed ? "✅ YA" : "❌ TIDAK"}*\n` +
              `• Total Grup Diizinkan: *${allowed.length} Grup*\n\n` +
              `*Penggunaan:*\n` +
              `│ \`${activePrefix}lockgc on/off\` - Aktifkan/matikan proteksi group lock\n` +
              `│ \`${activePrefix}lockgc allow\` - Izinkan bot aktif di grup ini\n` +
              `│ \`${activePrefix}lockgc del\` - Cabut izin bot di grup ini\n` +
              `│ \`${activePrefix}lockgc list\` - Lihat daftar grup yang diizinkan`,
          },
          { quoted: msg }
        );
      }

      if (action === "on" || action === "aktif" || action === "enable") {
        db.updateSettings({ groupLock: true });
        return sock.sendMessage(
          remoteJid,
          { text: "✅ *Group Lock Aktif:* Bot hanya akan merespons di grup yang terdaftar dalam daftar izin (allowed list)." },
          { quoted: msg }
        );
      }

      if (action === "off" || action === "mati" || action === "disable") {
        db.updateSettings({ groupLock: false });
        return sock.sendMessage(
          remoteJid,
          { text: "✅ *Group Lock Nonaktif:* Bot kini dapat merespons di semua grup." },
          { quoted: msg }
        );
      }

      if (action === "allow" || action === "add") {
        const allowed = [...(currentSettings.allowedGroups || [])];
        if (allowed.includes(remoteJid)) {
          return sock.sendMessage(
            remoteJid,
            { text: "ℹ️ Grup ini sudah terdaftar dalam daftar izin." },
            { quoted: msg }
          );
        }
        allowed.push(remoteJid);
        db.updateSettings({ allowedGroups: allowed });
        return sock.sendMessage(
          remoteJid,
          { text: "✅ Berhasil! Grup ini telah diizinkan dan bot akan merespons chat di grup ini." },
          { quoted: msg }
        );
      }

      if (action === "del" || action === "remove") {
        const allowed = [...(currentSettings.allowedGroups || [])];
        const idx = allowed.indexOf(remoteJid);
        if (idx === -1) {
          return sock.sendMessage(
            remoteJid,
            { text: "⚠️ Grup ini belum ada di dalam daftar izin." },
            { quoted: msg }
          );
        }
        allowed.splice(idx, 1);
        db.updateSettings({ allowedGroups: allowed });
        return sock.sendMessage(
          remoteJid,
          { text: "✅ Berhasil! Izin bot untuk grup ini telah dicabut." },
          { quoted: msg }
        );
      }

      if (action === "list") {
        const allowed = currentSettings.allowedGroups || [];
        if (allowed.length === 0) {
          return sock.sendMessage(
            remoteJid,
            { text: "ℹ️ Belum ada grup yang diizinkan." },
            { quoted: msg }
          );
        }
        let listTxt = `📋 *Daftar Grup yang Diizinkan (${allowed.length})*\n\n`;
        allowed.forEach((gid, i) => {
          listTxt += `${i + 1}. \`${gid}\`${gid === remoteJid ? " *(Grup Ini)*" : ""}\n`;
        });
        return sock.sendMessage(remoteJid, { text: listTxt.trim() }, { quoted: msg });
      }
    },
  },
];
