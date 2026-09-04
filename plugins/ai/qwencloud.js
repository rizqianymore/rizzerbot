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
      const systemInstruction =
        "Instruksi: Jawab dengan ramah, jelas, to the point, dan rangkum HANYA dalam 1 paragraf singkat (maksimal 3-4 kalimat). Dilarang membuat poin-poin, list nomor, atau penjelasan yang bertele-tele.";
      const finalPrompt = `${systemInstruction}\n\nPertanyaan: ${prompt}`;

      const result = await askQwenCloud(finalPrompt, {
        modelId: "qwen3.8-max",
        enableThinking: false,
      });

      await sock.sendMessage(
        remoteJid,
        { text: result.answer },
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
