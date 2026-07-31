export default {
  name: "ping",
  description: "Cek kecepatan respon bot.",
  usage: "",
  aliases: [],
  category: "User",
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();
    const start = Date.now();
    const pingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      { text: "Pinging..." },
      { quoted: msg }
    );
    const end = Date.now();
    await sock.sendMessage(msg.key.remoteJid, {
      text: `Pong! 🏓\nKecepatan respon: ${end - start}ms`,
      edit: pingMsg.key,
    });
  },
};
