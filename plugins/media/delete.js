export default {
  name: "delete",
  description: "Menghapus pesan bot dengan membalas pesannya.",
  usage: "<balas pesan bot>",
  example: "",
  aliases: ["del"],
  category: "Media",
  run: async (sock, msg, args) => {
    const quotedCtx = msg.message.extendedTextMessage?.contextInfo;
    if (!quotedCtx?.stanzaId) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Balas pesan bot untuk menghapusnya." },
        { quoted: msg },
      );
      return;
    }

    const normalizeJid = (jid) => (jid ? jid.replace(/:.*@/, "@") : "");
    const botJid = normalizeJid(sock.user?.id || "");
    const quotedParticipant = quotedCtx.participant
      ? normalizeJid(quotedCtx.participant)
      : "";
    const isFromBot = !quotedCtx.participant || quotedParticipant === botJid;

    await sock.sendMessage(msg.key.remoteJid, {
      delete: {
        remoteJid: msg.key.remoteJid,
        fromMe: isFromBot,
        id: quotedCtx.stanzaId,
        participant: quotedCtx.participant,
      },
    });
  },
};
