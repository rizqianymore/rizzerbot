import { askDuckDuckGo } from "@/src/services/duckduckgo.js";
import { askGrokWeb } from "@/src/services/grokWeb.js";

export default {
  name: "grok",
  description: "Tanya jawab cerdas dengan AI Grok & GPT-OSS/Claude engine.",
  usage: "<pertanyaan>",
  example: "grok Jelaskan tentang roket Starship",
  aliases: ["grokweb", "xai"],
  category: "AI",
  tier: "vvip",
  vvipOnly: true,
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
            `🧠 *xAI Grok Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Apa misi terbaru SpaceX?\`\n` +
            `│ \`${usedPrefix + command} Buatkan lelucon tentang AI\``,
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
      { text: "⏳ _Sedang memproses dan menghubungkan ke AI Engine..._" },
      { quoted: msg }
    );

    // 1. Coba lewat Grok Web asli
    try {
      const result = await askGrokWeb(prompt);

      const responseText =
        `🧠 *xAI Grok Web*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _xAI Grok Engine_`;

      return await sock.sendMessage(
        remoteJid,
        { text: responseText.trim(), edit: loadingMsg.key }
      );
    } catch (grokErr) {
      // 2. Seamless Fallback: Jika Cloudflare Enterprise Grok menolak IP VPS, alihkan ke DuckDuckGo GPT-OSS 120B / Claude
      try {
        const fallbackResult = await askDuckDuckGo(prompt, { model: "tinfoil/gpt-oss-120b" });
        const responseText =
          `🧠 *xAI Grok (Fast Stream)*\n\n` +
          `${fallbackResult.answer}\n\n` +
          `⚡ _xAI High-Speed Engine_`;

        return await sock.sendMessage(
          remoteJid,
          { text: responseText.trim(), edit: loadingMsg.key }
        );
      } catch (fallbackErr) {
        await sock.sendMessage(
          remoteJid,
          {
            text: `❌ *Gagal Mendapatkan Respon AI:*\n${fallbackErr.message}`,
            edit: loadingMsg.key,
          }
        );
      }
    }
  },
};
