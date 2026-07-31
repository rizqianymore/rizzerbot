export default {
  name: "react",
  description: "Mengirimkan reaksi emoji ke suatu pesan.",
  usage: "<emoji>",
  example: "🔥",
  category: "Media",
  premiumOnly: true,
  run: async (sock, msg, args) => {
    const emoji = args[0] || "🔥";
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  },
};
