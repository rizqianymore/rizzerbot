import { askQwen, QWEN_MODELS } from "@/src/services/qwen.js";

export default {
  name: "ai",
  description: "Tanya AI Qwen dengan berbagai pilihan model (Coder, Max, Plus, Flash, Vision, Thinking).",
  usage: "<pertanyaan> [--model <nama>] [--think]",
  example: "ai buatkan scraper nodejs --model coder --think",
  aliases: ["qwen", "qwencoder", "qwenflash", "qwenmax", "coder", "ask"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  run: async (sock, msg, args, { sendTyping, activePrefix, commandName }) => {
    const text = args.join(" ").trim();

    if (!text) {
      const listModels = Object.keys(QWEN_MODELS).slice(0, 10).join(", ");
      const prefix = activePrefix || ".";
      const cmd = commandName || "ai";

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `💡 *Format Penggunaan Qwen AI:*\n\n` +
            `• *Query Biasa:* \`${prefix}${cmd} <pertanyaan / coding>\`\n` +
            `• *Pilih Model:* \`${prefix}${cmd} --model qwen-max <pertanyaan>\`\n` +
            `• *Sertakan Thinking:* \`${prefix}${cmd} --think <pertanyaan>\`\n\n` +
            `📌 *Available Models:* \`${listModels}\``,
        },
        { quoted: msg }
      );
      return;
    }

    let selectedModel = "qwen3-coder-plus";
    let includeThinking = false;
    let cleanText = text;

    // Auto-detect model dari nama command yang dipanggil
    const lowerCmd = (commandName || "").toLowerCase();
    if (/coder|code/i.test(lowerCmd)) selectedModel = "qwen3-coder-plus";
    if (/flash/i.test(lowerCmd)) selectedModel = "qwen3-coder-flash";
    if (/max/i.test(lowerCmd)) selectedModel = "qwen-max";

    // Flag parser (--model <nama> & --think)
    if (cleanText.includes("--model")) {
      const parts = cleanText.split(/--model\s+([^\s]+)/i);
      if (parts.length >= 3) {
        selectedModel = parts[1];
        cleanText = (parts[0] + parts[2]).trim();
      }
    }

    if (cleanText.includes("--think")) {
      includeThinking = true;
      cleanText = cleanText.replace(/--think/gi, "").trim();
    }

    if (!cleanText) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Pertanyaan tidak boleh kosong setelah menghapus opsi." },
        { quoted: msg }
      );
      return;
    }

    // Presence & React status
    await sendTyping();
    sock.sendMessage(msg.key.remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const result = await askQwen({
        prompt: cleanText,
        model: selectedModel,
        includeThinking: includeThinking,
      });

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: result },
        { quoted: msg }
      );

      sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[QWEN ERROR]:", err);
      sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Qwen Error:*\n${err.message}` },
        { quoted: msg }
      );
    }
  },
};
