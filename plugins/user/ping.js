export default {
  name: "ping",
  description: "Check bot speed",
  usage: "",
  category: "User",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    sendTyping();
    const start = Date.now();
    const sent = await sock.sendMessage(msg.key.remoteJid, { text: "Ping..." }, { quoted: msg });
    const speed = Date.now() - start;
    if (sent?.key) {
      await sock.sendMessage(msg.key.remoteJid, { text: `*PONG!*\nKecepatan: *${speed}ms*`, edit: sent.key }).catch(() => {});
    }
  },
};
