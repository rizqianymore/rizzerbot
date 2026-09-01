import { askGeminiWeb } from "@/src/services/geminiWeb.js";
import { askDuckDuckGo } from "@/src/services/duckduckgo.js";
import { askQwen3 } from "@/src/services/qwen3.js";

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

    const loadingMsg = await sock.sendMessage(
      remoteJid,
      { text: "✨ _Sedang memproses pertanyaan dengan Google Gemini..._" },
      { quoted: msg }
    );

    // 1. Coba lewat Google Gemini Web
    try {
      const result = await askGeminiWeb(prompt);

      const responseText =
        `✨ *Google Gemini Web*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _Google Gemini Engine_`;

      return await sock.sendMessage(
        remoteJid,
        { text: responseText.trim(), edit: loadingMsg.key }
      );
    } catch (geminiErr) {
      // 2. High-speed Google Gemma / DuckDuckGo Fallback jika browser delay/timeout
      try {
        const gemmaResult = await askDuckDuckGo(prompt, { model: "tinfoil/gemma4-31b" });

        const responseText =
          `✨ *Google Gemini (Fast Engine)*\n\n` +
          `${gemmaResult.answer}\n\n` +
          `⚡ _Google AI Cloud Engine_`;

        return await sock.sendMessage(
          remoteJid,
          { text: responseText.trim(), edit: loadingMsg.key }
        );
      } catch (gemmaErr) {
        // 3. Ultra backup via OverChat
        try {
          const qwenResult = await askQwen3(prompt);
          const responseText =
            `✨ *Google Gemini (Backup Engine)*\n\n` +
            `${qwenResult.answer}\n\n` +
            `⚡ _Google AI Cloud Engine_`;

          return await sock.sendMessage(
            remoteJid,
            { text: responseText.trim(), edit: loadingMsg.key }
          );
        } catch (finalErr) {
          await sock.sendMessage(
            remoteJid,
            {
              text: `❌ *Gagal Mendapatkan Respon Gemini:*\n${finalErr.message}`,
              edit: loadingMsg.key,
            }
          );
        }
      }
    }
  },
};
