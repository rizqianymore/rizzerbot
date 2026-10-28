export default {
  name: "setbio",
  aliases: ["setstatusbot", "setabout"],
  description: "Mengubah bio / status About pada profil WhatsApp bot",
  usage: "<status baru>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) {
      return reply("Ketik status bio baru! Contoh: `.setbio Active RizzerBot Downloader`");
    }

    try {
      await sock.updateProfileStatus(text);
      await reply(`✅ Berhasil memperbarui bio profil bot menjadi:\n*"${text}"*`);
    } catch (err) {
      await reply(`Gagal memperbarui bio profil: ${err?.message || err}`);
    }
  },
};
