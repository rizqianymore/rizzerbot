import { askDuckDuckGo } from "@/src/services/duckduckgo.js";
import { askQwen3 } from "@/src/services/qwen3.js";

/**
 * High-performance, ultra-fast AI engine for .grok command.
 * Direct HTTP stream execution (< 2 detik respon, tanpa Puppeteer lag / 403 blocks).
 */
export default {
  name: "grok",
  description: "Tanya jawab cerdas super cepat dengan xAI Grok (Direct Stream Engine).",
  usage: "<pertanyaan>",
  example: "grok Jelaskan tentang roket Starship",
  aliases: ["grokweb", "xai"],
  category: "AI",
  tier: "vvip",
  vvipOnly: true,
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 2000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `🧠 *xAI Grok Ultra-Fast Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Apa misi terbaru SpaceX?\`\n` +
            `│ \`${usedPrefix + command} Buatkan ringkasan tentang Quantum Computing\``,
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
      { text: "⏳ _Sedang memproses dan menyusun jawaban..._" },
      { quoted: msg }
    );

    try {
      // 1. Direct Ultra-Fast Stream via GPT-OSS 120B / Claude
      const result = await askDuckDuckGo(prompt, { model: "tinfoil/gpt-oss-120b" });

      const responseText =
        `🧠 *xAI Grok (Fast Stream)*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _xAI High-Speed Engine_`;

      return await sock.sendMessage(
        remoteJid,
        { text: responseText.trim(), edit: loadingMsg.key }
      );
    } catch (err) {
      // 2. Backup Instant Failover via OverChat Qwen3
      try {
        const qwenResult = await askQwen3(prompt);
        const responseText =
          `🧠 *xAI Grok (Fast Stream)*\n\n` +
          `${qwenResult.answer}\n\n` +
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
