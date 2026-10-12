import { db } from '@/src/core/database.js';

export default {
  "name": "postch",
  "aliases": ["postsaluran","chpost"],
  "description": "Kirim pesan / pengumuman manual dari bot langsung ke saluran resmi",
  "usage": "<pesan>",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, quoted, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Posting ke saluran resmi hanya dapat dilakukan oleh SuperOwner Bot Utama.");
      }
      await sendTyping();
      const settings = db.main().getSettings();
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
};
