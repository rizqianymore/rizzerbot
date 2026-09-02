import { askNoTrackAI, AVAILABLE_MODELS } from "@/src/services/notrack.js";

export default {
  name: "notrack",
  description: "Tanya jawab cerdas dengan AI NoTrack (No-log, Uncensored & Multi-Model).",
  usage: "<pertanyaan> [--model <C|O|D|G>]",
  example: "notrack Jelaskan apa itu zero knowledge proof --model C",
  aliases: ["notrackai", "ntai"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      const modelList = AVAILABLE_MODELS.map(
        (m) => `• *${m.id}* — ${m.name}`
      ).join("\n");

      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `🤖 *NoTrack AI Assistant*\n\n` +
            `*Penggunaan:*\n` +
            `│ \`${usedPrefix + command} <pertanyaan>\`\n` +
            `│ \`${usedPrefix + command} <pertanyaan> --model <C/O/D/G>\`\n\n` +
            `*Model Tersedia:*\n` +
            `${modelList}\n\n` +
            `*Contoh:*\n` +
            `│ \`${usedPrefix + command} Apa itu quantum computing?\`\n` +
            `│ \`${usedPrefix + command} Buatkan kode Python --model O\``,
        },
        { quoted: msg }
      );
    }

    let rawText = args.join(" ").trim();
    let selectedModel = "C";

    // Flag parser: --model <model> / -m <model>
    const modelFlagMatch = rawText.match(/(?:--model|-m)\s+([a-zA-Z0-9.\-_/]+)/i);
    if (modelFlagMatch) {
      const modelKey = modelFlagMatch[1].toUpperCase();
      rawText = rawText.replace(modelFlagMatch[0], "").trim();

      if (["C", "O", "D", "G"].includes(modelKey)) {
        selectedModel = modelKey;
      }
    }

    if (!rawText) {
      return await sendUsage();
    }

    await sendTyping();

    try {
      const result = await askNoTrackAI(rawText, { model: selectedModel });

      const modelInfo = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
      const modelLabel = modelInfo ? modelInfo.name : selectedModel;

      let responseText =
        `🤖 *NoTrack AI* (${modelLabel})\n\n` +
        `${result.answer}\n\n` +
        `⚡ _Engine: notrack.ai (Zero-Log)_`;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim() },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon NoTrack AI:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
