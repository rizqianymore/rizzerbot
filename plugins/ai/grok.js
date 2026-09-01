import { askGrokWeb } from "@/src/services/grokWeb.js";

export default {
  name: "grok",
  description: "Tanya jawab cerdas dengan xAI Grok Web.",
  usage: "<pertanyaan>",
  example: "grok Jelaskan tentang roket Starship",
  aliases: ["grokweb", "xai"],
  category: "AI",
  tier: "vvip",
  vvipOnly: true,
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, sendUsage, usedPrefix, command }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sock.sendMessage(
        remoteJid,
        {
          text:
            `🧠 *xAI Grok Web Assistant*\n\n` +
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
      { text: "⏳ _Sedang memproses dan menghubungkan ke xAI Grok..._" },
      { quoted: msg }
    );

    try {
      const result = await askGrokWeb(prompt);

      const responseText =
        `🧠 *xAI Grok Web*\n\n` +
        `${result.answer}\n\n` +
        `⚡ _xAI Grok Engine_`;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim(), edit: loadingMsg.key }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon Grok:*\n${err.message}`,
          edit: loadingMsg.key,
        }
      );
    }
  },
};
