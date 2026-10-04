import { db } from '@/src/core/database.js';

export default {
  "name": "setch",
  "aliases": ["setsaluran","setchannel"],
  "description": "Atur ID/link saluran (newsletter) resmi bot untuk posting struk/update",
  "usage": "<jid/link saluran>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Pengaturan saluran resmi hanya dapat diubah oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const input = args[0]?.trim();
      if (!input) {
        const cur = db.main().getSettings();
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
        db.main().updateSettings({ channelName: newName });
        return reply(`✅ Nama saluran bot berhasil diubah menjadi: *${newName}*`);
      }

      let channelJid = input;

      if (input.includes("whatsapp.com/channel/")) {
        const code = input.split("whatsapp.com/channel/")[1]?.split(/[\/\?\s]/)[0];
        if (code && sock.newsletterMetadata) {
          try {
            const meta = await sock.newsletterMetadata("invite", code);
            if (meta?.id) {
              channelJid = meta.id;
            }
          } catch (e) {

          }
        }
      }

      if (!channelJid.includes("@newsletter")) {

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

      db.main().updateSettings({ channelJid });
      reply(
        `✅ *Saluran Berhasil Diatur!*\n\n` +
        `📢 *JID Saluran:* \`${channelJid}\`\n` +
        `⚡ *Auto-Forward TRX:* Otomatis aktif. Setiap transaksi atau orderan baru akan dikirimkan ke saluran ini.`
      );
    },
};
