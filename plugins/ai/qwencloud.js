import { askQwenCloud } from "@/src/services/qwencloud.js";

export default {
  name: "qwencloud",
  description: "Tanya jawab cerdas dengan Qwen3.8-Max via QwenCloud Stream Gateway.",
  usage: "<pertanyaan>",
  example: "qwencloud jelaskan tentang teori relativitas",
  aliases: ["qcloud", "qwenmax"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, sendUsage }) => {
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
      const result = await askQwenCloud(prompt, {
        modelId: "qwen3.8-max",
        enableThinking: false,
      });

      const responseText = `🤖 *QwenCloud AI (qwen3.8-max):*\n\n${result.answer}`;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim() },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon QwenCloud:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
