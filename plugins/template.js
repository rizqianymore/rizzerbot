export default {
  name: "template", // Nama command utama yang akan dipanggil (contoh: .template)
  description: "Deskripsi singkat tentang kegunaan command ini.",
  usage: "<argumen>", // Panduan penggunaan parameter
  example: "template hello", // Contoh penggunaan command
  aliases: ["alias1", "alias2"], // Nama alternatif command
  category: "User", // Kategori menu (User / Media / OSINT / Downloader / Owner)
  premiumOnly: false, // Set true jika command hanya untuk user premium
  ownerOnly: false, // Set true jika command hanya untuk owner bot
  run: async (sock, msg, args, { sendTyping }) => {
    // 1. Tampilkan status typing saat command diproses
    await sendTyping();

    // 2. Ambil parameter/argumen dari user
    const text = args.join(" ").trim();
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap masukkan teks setelah command!" },
        { quoted: msg }
      );
      return;
    }

    // 3. Eksekusi logika utama perintah Anda di sini
    const responseText = `Halo! Kamu mengirim teks: ${text}`;

    // 4. Kirim kembali respons ke WhatsApp
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: responseText },
      { quoted: msg }
    );
  },
};
