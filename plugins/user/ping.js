

export default {
  "name": "ping",
  "description": "Check bot speed",
  "usage": "",
  "category": "User",
  "run": async (sock, msg, args, { reply, senderJid, sendTyping }) => {
      await sendTyping();
      const start = Date.now();
      await sock.sendMessage(msg.key.remoteJid, { text: "⚡ Ping..." }, { quoted: msg });
      const speed = Date.now() - start;
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⚡ *PONG!*\nKecepatan: *${speed}ms*` },
        { quoted: msg }
      );
    },
};
