import { askQwenWeb, MODEL_ALIASES, DEFAULT_MODEL } from "@/src/services/qwenWeb.js";
import { db } from "@/src/core/database.js";

export default {
  name: "ai",
  description: "Tanya jawab cerdas dengan AI (Qwen Web Engine via OmniRoute).",
  usage: "<pertanyaan> [--model <model>] [--think]",
  example: "ai jelaskan teori relativitas --think",
  aliases: ["qwen", "tanya", "ask"],
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

    // ── Subcommand: Owner Update Cookie ────────────────────────────────────
    if (args[0] === "--cookie" || args[0] === "--setcookie") {
      if (!isOwner) {
        return await sock.sendMessage(
          remoteJid,
          { text: "👑 *Owner Only:* Pengaturan cookie AI hanya dapat dilakukan oleh Owner." },
          { quoted: msg }
        );
      }

      const cookieVal = args.slice(1).join(" ").trim();
      if (!cookieVal) {
        return await sock.sendMessage(
          remoteJid,
          { text: `⚠️ *Format:* \`${activePrefix}ai --cookie <nilai_cookie>\`` },
          { quoted: msg }
        );
      }

      if (!db.data.settings) db.data.settings = {};
      db.data.settings.qwenCookie = cookieVal;
      await db.save();

      return await sock.sendMessage(
        remoteJid,
        { text: "✅ *Berhasil:* Cookie Qwen Web berhasil disimpan ke database!" },
        { quoted: msg }
      );
    }

    // ── Subcommand: List Available Models ───────────────────────────────────
    if (args[0] === "--models" || args[0] === "-models") {
      const modelList = [
        "• *qwen3.7-max* (Default - High Intelligence)",
        "• *qwen3.7-plus* / *plus* (Balanced Speed & Quality)",
        "• *qwen3.6-plus* / *turbo* (Fast & Lightweight)",
        "• *qwen3.8-max* (Deep Thinking / Reasoning)",
        "• *qwen3-coder-plus* / *coder* (Specialized for Programming)",
      ].join("\n");

      return await sock.sendMessage(
        remoteJid,
        {
          text: `🤖 *Daftar Model Qwen Web OmniRoute:*\n\n${modelList}\n\n*Cara Pakai:* \`${activePrefix}ai Jelaskan konsep OOP --model coder\``,
        },
        { quoted: msg }
      );
    }

    // ── Parse Flags (--model, --think) ─────────────────────────────────────
    let model = DEFAULT_MODEL;
    let includeThinking = false;
    let cleanPrompt = rawInput;

    const modelMatch = cleanPrompt.match(/(?:--model|-m)\s+([a-zA-Z0-9.\-_]+)/i);
    if (modelMatch) {
      model = modelMatch[1];
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
      const result = await askQwenWeb({
        prompt: cleanPrompt,
        model,
        includeThinking,
      });

      let responseText = `🤖 *Qwen AI (${result.model})*\n\n`;

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
