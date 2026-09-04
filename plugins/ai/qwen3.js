import { askQwen3 } from "@/src/services/qwen3.js";
import { formatLLMPrompt } from "@/src/utils/aiPrompt.js";

export default {
  name: "qwen3",
  description: "Tanya jawab cerdas dengan AI Qwen3 80B via OverChat (Gratis & No WAF).",
  usage: "<pertanyaan>",
  example: "qwen3 Apa itu machine learning?",
  aliases: ["qwen", "qw3", "ai"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
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
      const result = await askQwen3(formatLLMPrompt(prompt));

      await sock.sendMessage(
        remoteJid,
        { text: result.answer },
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
