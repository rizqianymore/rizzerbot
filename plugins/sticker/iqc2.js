// plugins/sticker/iqc2.js — perintah "iqc2" (1 file = 1 perintah).
export default {
  "name": "iqc2",
  "aliases": ["iqc"],
  "description": "Maker iPhone quoted chat via deline API",
  "usage": "<teks>|<chatTime>|<statusBarTime>",
  "category": "Sticker",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      const text = args.join(" ").trim();

      if (!text) {
        return reply(
          "Contoh penggunaan:\n\n" +
          "Otomatis:\n.iqc2 Halo hilman\n\n" +
          "Manual:\n.iqc2 Halo hilman|22:11|22:20"
        );
      }

      const [rawMsg, rawChatTime, rawStatusBarTime] = text.split("|");

      if (!rawMsg?.trim()) {
        return reply("❌ Teks tidak boleh kosong! Contoh: *.iqc2 Halo hilman*");
      }

      const now = new Date();
      const autoTime = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const chatTime = rawChatTime ? rawChatTime.trim() : autoTime;
      const statusBarTime = rawStatusBarTime ? rawStatusBarTime.trim() : autoTime;

      const url =
        `https://api.deline.web.id/maker/iqc?text=${encodeURIComponent(rawMsg.trim())}` +
        `&chatTime=${encodeURIComponent(chatTime)}` +
        `&statusBarTime=${encodeURIComponent(statusBarTime)}`;

      await sendTyping();
      await sock.sendMessage(msg.key.remoteJid, { react: { text: "🕕", key: msg.key } }).catch(() => {});

      try {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url }, caption: "" },
          { quoted: msg }
        );
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return reply(`❌ Gagal membuat iqc: ${err.message}`);
      }
    },
};
