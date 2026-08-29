import { fetchBuffer } from "@/src/utils/scraping.js";

export default {
  premiumOnly: true,
  description: "Membuat gambar kode QR dari teks.",
  usage: "<teks>",
  example: "https://github.com/",
  name: "qr",
  aliases: ["qrmaker", "qrcode"],
  category: "Tools",
  run: async (sock, msg, args, { sendTyping }) => {
    const text = args.join(" ");
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap tentukan teks atau link yang ingin diubah menjadi QR Code!\nContoh: *.qr https://github.com*",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text: "⏳ Sedang membuat QR Code...",
      },
      { quoted: msg },
    );

    try {
      const size = "512x512";
      const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}`;

      const buffer = await fetchBuffer(apiUrl);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: buffer,
          caption:
            `📸 *QR Code Berhasil Dibuat!*\n\n` +
            `🔗 *Data:* ${text}\n` +
            `📊 *Ukuran:* ${size}\n\n` +
            `⚡ _Via Kyros-MD API_`,
        },
        { quoted: msg },
      );
    } catch (err) {
      console.error("QR Generator Error:", err.message);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "❌ Gagal membuat QR Code. Coba lagi nanti.",
        },
        { quoted: msg },
      );
    }
  },
};
