import { getGroupContext } from "./_context.js";
import { invalidateGroupMeta } from "@/src/utils/helper.js";
import { db } from "@/src/core/database.js";

export default {
  name: "add",
  groupOnly: true,
  groupAdminOnly: true,
  botAdminOnly: true,
  aliases: ["tambah", "invite"],
  description: "Menambahkan / mengundang member ke grup",
  usage: "628xxx",
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
      return context.reply("Masukkan nomor WhatsApp yang ingin ditambahkan! Contoh: *.add 62812345678*");
    }

    try {
      const response = await sock.groupParticipantsUpdate(ctx.remoteJid, [targetJid], "add");
      invalidateGroupMeta(ctx.remoteJid, sock);

      const status = response?.[0]?.status;
      if (status === "403" || status === "408") {
        const code = await sock.groupInviteCode(ctx.remoteJid).catch(() => null);
        if (code) {
          const inviteUrl = `https://chat.whatsapp.com/${code}`;
          // coba DM, fallback ke grup
          try {
            await sock.sendMessage(targetJid, {
              text: `Kamu diundang ke grup *${ctx.meta.subject}*\n${inviteUrl}`,
            });
            await context.reply(`Undangan dikirim via DM ke @${targetJid.split("@")[0]} (privasi ketat).`, {
              mentions: [targetJid],
            });
          } catch {
            await context.reply(
              `Tidak dapat add @${targetJid.split("@")[0]} (privasi). Share link ini:\n${inviteUrl}`,
              { mentions: [targetJid] }
            );
          }
        } else {
          await context.reply(`Gagal buat invite link.`);
        }
      } else if (status === "409") {
        await context.reply(`User @${targetJid.split("@")[0]} sudah berada di dalam grup.`);
      } else {
        await sock.sendMessage(
          ctx.remoteJid,
          {
            text: `Berhasil menambahkan @${targetJid.split("@")[0]} ke dalam grup.`,
            mentions: [targetJid],
          },
          { quoted: msg }
        );
      }
    } catch (err) {
      await context.reply(`Gagal menambahkan member: ${err.message}`);
    }
  },
};
