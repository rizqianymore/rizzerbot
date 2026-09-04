import { askDeepAI } from "@/src/services/deepai.js";

export default {
  name: "deepai",
  description: "Tanya jawab cerdas dengan DeepAI Chat (Cepat, simpel & akurat).",
  usage: "<pertanyaan>",
  example: "deepai apa itu black hole",
  aliases: ["dpai", "deep"],
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
      const systemInstruction =
        "Instruksi: Jawab dengan ramah, jelas, to the point, dan rangkum HANYA dalam 1 paragraf singkat (maksimal 3-4 kalimat). Dilarang membuat poin-poin atau list bertele-tele.";
      const finalPrompt = `${systemInstruction}\n\nPertanyaan: ${prompt}`;

      const result = await askDeepAI(finalPrompt);

      await sock.sendMessage(
        remoteJid,
        { text: result.answer },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon DeepAI:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
