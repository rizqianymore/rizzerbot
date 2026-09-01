import { askGeminiWeb } from "@/src/services/geminiWeb.js";

export default {
  name: "gemini",
  description: "Tanya jawab cerdas dengan Google Gemini Web via browser automation.",
  usage: "<pertanyaan>",
  example: "gemini Jelaskan cara kerja browser automation",
  aliases: ["geminiweb", "gweb"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `✨ *Google Gemini Web AI Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Apa itu quantum computing?\`\n` +
            `│ \`${usedPrefix + command} Buatkan artikel singkat tentang AI\``,
        },
        { quoted: msg }
      );
    }

    const prompt = args.join(" ").trim();
    if (!prompt) {
      return await sendUsage();
    }

    await sendTyping();

    try {
      const result = await askGeminiWeb(prompt);

      const responseText =
        `✨ *Google Gemini Web*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _Google Gemini Engine_`;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim() },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon Gemini:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
