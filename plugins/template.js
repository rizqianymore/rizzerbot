export default {
  name: "template", 
  description: "Deskripsi singkat tentang kegunaan command ini.",
  usage: "<argumen>", 
  example: "template hello", 
  aliases: ["alias1", "alias2"], 
  category: "User", 
  premiumOnly: false, 
  ownerOnly: false, 
  run: async (sock, msg, args, { sendTyping }) => {
    
    await sendTyping();

    
    const text = args.join(" ").trim();
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap masukkan teks setelah command!" },
        { quoted: msg }
      );
      return;
    }

    
    const responseText = `Halo! Kamu mengirim teks: ${text}`;

    // 4. Kirim kembali respons ke WhatsApp
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: responseText },
      { quoted: msg }
    );
  },
};
