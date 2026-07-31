export default {
  name: "addbot",
  description: "Menambahkan dan menginisialisasi sesi bot sekunder baru.",
  usage: "<nomor hp>",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const targetNumber = args[0]?.replace(/[^0-9]/g, "");
    if (!targetNumber) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Harap tentukan nomor telepon bot sekunder. Contoh: *.addbot 628xxx*" },
        { quoted: msg }
      );
      return;
    }
    await sendTyping();
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `⏳ Sedang menginisialisasi sesi baru untuk ${targetNumber}...` },
      { quoted: msg }
    );
    try {
      const { addSecondaryBot } = await import("@/index.js");
      const code = await addSecondaryBot(targetNumber);
      if (code) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `🔑 *PAIRING CODE BOT BARU (${targetNumber}):*\n\n*Code:* \`${code}\`\n\nMasukkan kode di atas pada WhatsApp di nomor tersebut (Perangkat Tertaut > Tautkan dengan nomor telepon).`,
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `✅ Sesi untuk nomor ${targetNumber} sudah terhubung sebelumnya dan aktif!` },
          { quoted: msg }
        );
      }
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal menambahkan bot sekunder: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
