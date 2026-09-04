import { askDuckDuckGo, AVAILABLE_MODELS } from "@/src/services/duckduckgo.js";
import { formatLLMPrompt } from "@/src/utils/aiPrompt.js";

export default {
  name: "duckduckgo",
  description: "Tanya jawab dengan DuckDuckGo AI (GPT-5.4 Mini, Claude Haiku 4.5, Mistral Small 4, Gemma 4, GPT-OSS).",
  usage: "<pertanyaan> [--model <model>]",
  example: "duckduckgo jelaskan teori relativitas --model claude",
  aliases: ["ddg", "duckai", "ddgai", "gpt5", "claude"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      const modelList = AVAILABLE_MODELS.map(
        (m) => `• *${m.name}* (\`${m.id}\`) — ${m.provider}`
      ).join("\n");

      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `🤖 *DuckDuckGo AI Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n` +
            `│ \`${usedPrefix + command} <pertanyaan> --model <nama_model>\`\n\n` +
            `*Model Tersedia (Gratis):*\n` +
            `${modelList}\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Siapa penemu komputer?\`\n` +
            `│ \`${usedPrefix + command} Jelaskan gravitasi --model claude\``,
        },
        { quoted: msg }
      );
    }

    let rawText = args.join(" ").trim();
    let selectedModel = "gpt-5.4-mini";

    // Shortcut alias routing
    if (command === "claude") {
      selectedModel = "claude-haiku-4-5";
    } else if (command === "gpt5") {
      selectedModel = "gpt-5.4-mini";
    }

    // Flag parser: --model <model> / -m <model>
    const modelFlagMatch = rawText.match(/(?:--model|-m)\s+([a-zA-Z0-9.\-_/]+)/i);
    if (modelFlagMatch) {
      const modelKey = modelFlagMatch[1].toLowerCase();
      rawText = rawText.replace(modelFlagMatch[0], "").trim();

      if (modelKey.includes("claude") || modelKey.includes("haiku")) {
        selectedModel = "claude-haiku-4-5";
      } else if (modelKey.includes("mistral")) {
        selectedModel = "mistral-small-2603";
      } else if (modelKey.includes("gemma")) {
        selectedModel = "tinfoil/gemma4-31b";
      } else if (modelKey.includes("oss") || modelKey.includes("gptoss")) {
        selectedModel = "tinfoil/gpt-oss-120b";
      } else if (modelKey.includes("gpt") || modelKey.includes("mini")) {
        selectedModel = "gpt-5.4-mini";
      } else {
        selectedModel = modelKey;
      }
    }

    if (!rawText) {
      return await sendUsage();
    }

    await sendTyping();

    try {
      const result = await askDuckDuckGo(formatLLMPrompt(rawText), { model: selectedModel });

      await sock.sendMessage(
        remoteJid,
        { text: result.answer },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon AI DuckDuckGo:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
