export default {
  name: "edit",
  description: "Mengedit pesan teks yang dikirim oleh bot.",
  usage: "<teks baru>",
  example: "Halo Dunia",
  category: "Media",
  run: async (sock, msg, args) => {
    const quotedCtx = msg.message.extendedTextMessage?.contextInfo;
    const newText = args.join(" ");
    if (!quotedCtx?.stanzaId || !newText) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Balas pesan bot dan tentukan teks baru. Contoh: *.edit Teks Baru*",
        },
        { quoted: msg },
      );
      return;
    }
    await sock.sendMessage(msg.key.remoteJid, {
      text: newText,
      edit: {
        remoteJid: msg.key.remoteJid,
        fromMe: true,
        id: quotedCtx.stanzaId,
        participant: quotedCtx.participant,
      },
    });
  },
};
