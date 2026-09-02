import { askChatbotChatApp } from "@/src/services/chatbotchatapp.js";

export default {
  name: "chatbotchatapp",
  description: "Tanya jawab cerdas dengan AI melalui ChatbotChatApp.",
  usage: "<pertanyaan>",
  example: "chatbotchatapp Jelaskan konsep dasar quantum computing",
  aliases: ["cbca", "chatgptapp", "chatapp"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sendUsage();
    }

    const prompt = args.join(" ").trim();
    if (!prompt) {
      return await sendUsage();
    }

    await sendTyping();

    try {
      const result = await askChatbotChatApp(prompt);

      const responseText =
        `🤖 *ChatbotChatApp AI*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _Engine: chatbotchatapp.com_`;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim() },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon AI:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
