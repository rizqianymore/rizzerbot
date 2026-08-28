import { askKimiWeb } from "@/src/services/kimiWeb.js";
import { askQwenWeb } from "@/src/services/qwenWeb.js";
import { db } from "@/src/core/database.js";

export default {
  name: "ai",
  description: "Tanya jawab cerdas dengan AI (Kimi AI & Qwen Web OmniRoute).",
  usage: "<pertanyaan> [--model kimi|qwen] [--think]",
  example: "ai jelaskan apa itu quantum computing --think",
  aliases: ["kimi", "qwen", "tanya", "ask"],
  category: "AI",
  premiumOnly: true,
  ownerOnly: false,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, sendUsage, isOwner, activePrefix }) => {
    const remoteJid = msg.key.remoteJid;

    if (!args || args.length === 0) {
      return await sendUsage();
    }

    const rawInput = args.join(" ").trim();

    // ── Subcommand: Owner Update Token / Cookie ─────────────────────────────
    if (args[0] === "--token" || args[0] === "--cookie" || args[0] === "--settoken") {
      if (!isOwner) {
        return await sock.sendMessage(
          remoteJid,
          { text: "👑 *Owner Only:* Pengaturan token AI hanya dapat dilakukan oleh Owner." },
          { quoted: msg }
        );
      }

      const inputVal = args.slice(1).join(" ").trim();
      if (!inputVal) {
        return await sock.sendMessage(
          remoteJid,
          { text: `⚠️ *Format:* \`${activePrefix}ai --token <access_token_kimi_atau_cookie>\`` },
          { quoted: msg }
        );
      }

      if (!db.data.settings) db.data.settings = {};

      // Simpan token untuk Kimi & Qwen
      db.data.settings.kimiToken = inputVal;
      db.data.settings.qwenCookie = inputVal;
      await db.save();

      return await sock.sendMessage(
        remoteJid,
        { text: "✅ *Berhasil:* Token AI berhasil disimpan ke database!" },
        { quoted: msg }
      );
    }

    // ── Subcommand: List Models ─────────────────────────────────────────────
    if (args[0] === "--models" || args[0] === "-models") {
      const modelList = [
        "• *kimi* / *k2* (Default - Kimi K2.6, Super Cepat & Tanpa WAF)",
        "• *qwen* / *qwen3.7-max* (Qwen High Intelligence / DashScope)",
        "• *coder* (Specialized for Programming)",
      ].join("\n");

      return await sock.sendMessage(
        remoteJid,
        {
          text: `🤖 *Pilihan Engine AI OmniRoute:*\n\n${modelList}\n\n*Contoh:* \`${activePrefix}ai Buat kode web scraping --model kimi\``,
        },
        { quoted: msg }
      );
    }

    // ── Parse Arguments & Flags ─────────────────────────────────────────────
    let selectedEngine = "kimi"; // Default to Kimi as it is simple and has NO WAF
    let includeThinking = false;
    let cleanPrompt = rawInput;

    const modelMatch = cleanPrompt.match(/(?:--model|-m)\s+([a-zA-Z0-9.\-_]+)/i);
    if (modelMatch) {
      const specifiedModel = modelMatch[1].toLowerCase();
      if (specifiedModel.includes("qwen") || specifiedModel.includes("dashscope") || specifiedModel.includes("coder")) {
        selectedEngine = "qwen";
      } else {
        selectedEngine = "kimi";
      }
      cleanPrompt = cleanPrompt.replace(modelMatch[0], "").trim();
    }

    if (/--think|-t\b/i.test(cleanPrompt)) {
      includeThinking = true;
      cleanPrompt = cleanPrompt.replace(/--think|-t\b/gi, "").trim();
    }

    if (!cleanPrompt) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ Masukkan pertanyaan yang ingin Anda tanyakan ke AI." },
        { quoted: msg }
      );
    }

    await sendTyping();

    try {
      let result;
      if (selectedEngine === "kimi") {
        result = await askKimiWeb({
          prompt: cleanPrompt,
          enableThinking: includeThinking,
        });
      } else {
        result = await askQwenWeb({
          prompt: cleanPrompt,
          includeThinking,
        });
      }

      let responseText = `🤖 *AI Assistant (${result.model})*\n\n`;

      if (includeThinking && result.reasoning) {
        responseText += `💭 *Thinking Process:*\n_${result.reasoning}_\n\n──────────────\n\n`;
      }

      responseText += result.content;

      await sock.sendMessage(
        remoteJid,
        { text: responseText.trim() },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `❌ *Gagal Mendapatkan Respon AI:*\n${err.message}`,
        },
        { quoted: msg }
      );
    }
  },
};
