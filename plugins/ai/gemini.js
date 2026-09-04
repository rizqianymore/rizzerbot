import { askGeminiWeb } from "@/src/services/geminiWeb.js";
import { askDuckDuckGo } from "@/src/services/duckduckgo.js";
import { askQwen3 } from "@/src/services/qwen3.js";
import { formatLLMPrompt } from "@/src/utils/aiPrompt.js";

export default {
  name: "gemini",
  description: "Tanya jawab cerdas dengan Google Gemini & Google Gemma Engine.",
  usage: "<pertanyaan>",
  example: "gemini Jelaskan cara kerja kecerdasan buatan",
  aliases: ["geminiweb", "gweb"],
  category: "AI",
  tier: "vip",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `✨ *Google Gemini AI Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Apa itu quantum computing?\`\n` +
            `│ \`${usedPrefix + command} Buatkan penjelasan singkat tentang AI\``,
        },
        { quoted: msg }
      );
    }

    const prompt = args.join(" ").trim();
    if (!prompt) {
      return await sendUsage();
    }

    await sendTyping();

    const formattedPrompt = formatLLMPrompt(prompt);

    // 1. Coba lewat Google Gemini Web
    try {
      const result = await askGeminiWeb(formattedPrompt);

      return await sock.sendMessage(
        remoteJid,
        { text: result.answer },
        { quoted: msg }
      );
    } catch (geminiErr) {
      // 2. High-speed Google Gemma / DuckDuckGo Fallback jika browser delay/timeout
      try {
        const gemmaResult = await askDuckDuckGo(formattedPrompt, {
          model: "tinfoil/gemma4-31b",
        });

        return await sock.sendMessage(
          remoteJid,
          { text: gemmaResult.answer },
          { quoted: msg }
        );
      } catch (gemmaErr) {
        // 3. Ultra backup via OverChat
        try {
          const qwenResult = await askQwen3(formattedPrompt);

          return await sock.sendMessage(
            remoteJid,
            { text: qwenResult.answer },
            { quoted: msg }
          );
        } catch (finalErr) {
          await sock.sendMessage(
            remoteJid,
            {
              text: `❌ *Gagal Mendapatkan Respon Gemini:*\n${finalErr.message}`,
            },
            { quoted: msg }
          );
        }
      }
    }
  },
};
