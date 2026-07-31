export default {
  name: "developer",
  description: "Menampilkan informasi developer dan lisensi bot.",
  usage: "",
  aliases: ["dev", "creator"],
  category: "User",
  run: async (sock, msg, args, context) => {
    const { sendTyping } = context;
    await sendTyping();

    const devText = `👨‍💻 *Developer & Penjual Bot*

• *Developer:* wa.me/6287847566690
• *Penjual:* wa.me/6287847566690

📝 *Penjelasan Bot:*
Kyros-MD adalah WhatsApp Bot modular berperforma tinggi yang dirancang untuk kebutuhan promosi massal (JPM), manajemen grup secara otomatis, serta pengunduhan berbagai media (Instagram, TikTok, YouTube, Spotify) dengan kecepatan respons optimal.

💰 *Daftar Harga Pembelian:*
• *Pembelian Source Code:* Rp 25.000 (Full script & gratis panduan instalasi)`;

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: devText },
      { quoted: msg }
    );
  },
};
