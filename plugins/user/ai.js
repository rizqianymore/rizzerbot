import axios from "axios";
import { db } from "@/src/core/database.js";

const AIHUBMIX_BASE_URL = "https://aihubmix.com/v1/chat/completions";
const AIHUBMIX_API_KEY =
  process.env.AIHUBMIX_API_KEY ||
  "sk-CtXrMk37pKQe4JoP71A415F56e6a48279c6c3dC14cF3F341";

export const POPULAR_FREE_MODELS = {
  "gemini-3.7-flash-free": {
    name: "Gemini 3.7 Flash Free",
    provider: "Google",
    alias: ["gemini", "gemini37", "gemini-flash"],
    fast: true,
  },
  "coding-glm-5.3-free": {
    name: "GLM 5.3 Free",
    provider: "Zhipu AI",
    alias: ["glm", "glm53", "glm-5.3"],
    fast: true,
  },
  "coding-glm-4.6-free": {
    name: "GLM 4.6 Free",
    provider: "Zhipu AI",
    alias: ["glm46", "glm-4.6"],
    fast: true,
  },
  "gpt-4.1-mini-free": {
    name: "GPT 4.1 Mini Free",
    provider: "OpenAI",
    alias: ["gpt", "gpt4", "gpt-mini"],
    fast: true,
  },
  "coding-kimi-k3-free": {
    name: "Kimi K3 Coding Free",
    provider: "Moonshot",
    alias: ["kimi", "kimi-k3"],
    fast: true,
  },
  "coding-minimax-m3-free": {
    name: "MiniMax M3 Free",
    provider: "MiniMax",
    alias: ["minimax", "minimax-m3"],
    fast: true,
  },
  "qwen3.6-plus-preview-free": {
    name: "Qwen 3.6 Plus Free",
    provider: "Qwen / Alibaba",
    alias: ["qwen", "qwen36"],
    fast: true,
  },
  "mimo-v2-flash-free": {
    name: "Xiaomi MiMo V2 Flash Free",
    provider: "Xiaomi",
    alias: ["mimo", "xiaomi"],
    fast: true,
  },
};

const DEFAULT_MODEL = "gemini-3.7-flash-free";

/**
 * Normalisasi nama/alias model yang diinput user
 */
function resolveModelName(input) {
  if (!input) return DEFAULT_MODEL;
  const clean = input.toLowerCase().trim().replace(/^--?/, "");

  if (POPULAR_FREE_MODELS[clean]) return clean;

  for (const [modelId, meta] of Object.entries(POPULAR_FREE_MODELS)) {
    if (meta.alias && meta.alias.includes(clean)) {
      return modelId;
    }
  }

  // Jika input berakhiran -free atau berupa nama model valid
  if (clean.includes("gemini") && clean.includes("3.7")) return "gemini-3.7-flash-free";
  if (clean.includes("gemini") && clean.includes("3.6")) return "gemini-3.6-flash-free";
  if (clean.includes("glm") && clean.includes("5.3")) return "coding-glm-5.3-free";
  if (clean.includes("glm") && clean.includes("4.6")) return "coding-glm-4.6-free";
  if (clean.includes("gpt")) return "gpt-4.1-mini-free";
  if (clean.includes("kimi")) return "coding-kimi-k3-free";
  if (clean.includes("minimax")) return "coding-minimax-m3-free";

  return clean.endsWith("-free") ? clean : DEFAULT_MODEL;
}

/**
 * Ekstrak teks quote dari pesan yang di-reply
 */
function getQuotedText(msg) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return "";

  return (
    quoted.conversation ||
    quoted.extendedTextMessage?.text ||
    quoted.imageMessage?.caption ||
    quoted.videoMessage?.caption ||
    quoted.documentMessage?.caption ||
    ""
  );
}

/**
 * Format menu daftar model
 */
function getModelListText(activePrefix, userModel) {
  let text = `╭─── . ݁₊ ⊹ *AI Models (AIHubMix Free)* ⊹ ₊ ݁.\n│ Model aktif kamu: \`${userModel}\`\n│\n`;

  for (const [id, meta] of Object.entries(POPULAR_FREE_MODELS)) {
    const isCurrent = id === userModel ? " *(Active)*" : "";
    text += `├─ *${meta.name}* (${meta.provider})${isCurrent}\n`;
    text += `│  • ID: \`${id}\`\n`;
    text += `│  • Alias: \`${meta.alias.join("`, `")}\`\n│\n`;
  }

  text += `╰──────────────\n\n`;
  text += `💡 *Cara Ganti Model:*\n`;
  text += `• Set default: \`${activePrefix}ai --set <model_id/alias>\`\n`;
  text += `• Panggil langsung: \`${activePrefix}ai -<alias> <pertanyaan>\`\n`;
  text += `  _Contoh:_ \`${activePrefix}ai -glm Apa itu quantum computing?\`\n`;
  text += `  _Contoh:_ \`${activePrefix}ai -gemini Buatkan pantun jenaka\``;

  return text.trim();
}

export default {
  name: "ai",
  description: "Bertanya atau berinteraksi dengan AI berkecepatan tinggi dengan multi-model switcher.",
  usage: "[--set <model> | -<model>] <prompt>",
  example: "ai -gemini Jelaskan cara kerja AI",
  aliases: ["aimodel", "gemini", "glm", "chatgpt", "ask", "botai", "gpt"],
  category: "User",
  premiumOnly: false,
  ownerOnly: false,
  run: async (sock, msg, args, context) => {
    const { sendTyping, sendUsage, activePrefix, senderJid, commandName } = context;

    const userProfile = db.getUser(senderJid) || {};
    let selectedModel = userProfile.aiModel || DEFAULT_MODEL;

    // Subcommand: .ai models / .ai --list / .aimodel
    if (
      commandName === "aimodel" ||
      args[0] === "models" ||
      args[0] === "--list" ||
      args[0] === "-l"
    ) {
      await sendTyping();
      const listText = getModelListText(activePrefix, selectedModel);
      return sock.sendMessage(msg.key.remoteJid, { text: listText }, { quoted: msg });
    }

    // Subcommand: .ai --set <model> / .ai setmodel <model>
    if (args[0] === "--set" || args[0] === "setmodel" || args[0] === "-s") {
      const targetModelInput = args[1];
      if (!targetModelInput) {
        return sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `⚠️ *Format salah!*\n\nGunakan: \`${activePrefix}ai --set <model_id/alias>\`\nContoh: \`${activePrefix}ai --set gemini\``,
          },
          { quoted: msg }
        );
      }

      const resolved = resolveModelName(targetModelInput);
      db.updateUser(senderJid, { aiModel: resolved });

      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Model AI Berhasil Diubah!*\n\nModel default kamu sekarang: *${resolved}*\nCoba tanyakan sesuatu dengan \`${activePrefix}ai <pertanyaan>\``,
        },
        { quoted: msg }
      );
    }

    // Alias check (misal dipanggil .gemini / .glm / .gpt)
    if (commandName === "gemini") selectedModel = "gemini-3.7-flash-free";
    if (commandName === "glm") selectedModel = "coding-glm-5.3-free";
    if (commandName === "gpt") selectedModel = "gpt-4.1-mini-free";

    // Cek flag model inline: .ai -m <model> <prompt> atau .ai -gemini <prompt>
    let remainingArgs = [...args];
    let enableThinking = false;

    if (remainingArgs.length > 0) {
      const firstArg = remainingArgs[0];

      if (firstArg === "-m" || firstArg === "--model") {
        if (remainingArgs[1]) {
          selectedModel = resolveModelName(remainingArgs[1]);
          remainingArgs = remainingArgs.slice(2);
        }
      } else if (firstArg.startsWith("-") && firstArg.length > 1) {
        const potentialModel = firstArg.slice(1).toLowerCase();
        if (potentialModel === "think" || potentialModel === "t") {
          enableThinking = true;
          remainingArgs = remainingArgs.slice(1);
        } else {
          const resolved = resolveModelName(potentialModel);
          if (resolved) {
            selectedModel = resolved;
            remainingArgs = remainingArgs.slice(1);
          }
        }
      }
    }

    let userPrompt = remainingArgs.join(" ").trim();
    const quotedText = getQuotedText(msg).trim();

    if (!userPrompt && quotedText) {
      userPrompt = quotedText;
    } else if (userPrompt && quotedText) {
      userPrompt = `Konteks/Pesan yang dikutip:\n"${quotedText}"\n\nPertanyaan/Instruksi:\n${userPrompt}`;
    }

    if (!userPrompt) {
      if (typeof sendUsage === "function") {
        return sendUsage();
      }
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⚠️ *Format salah!*\n\nGunakan: \`${activePrefix}ai <pertanyaan>\`\nContoh: \`${activePrefix}ai Jelaskan teori relativitas secara singkat\`\n\n💡 Ketik \`${activePrefix}ai models\` untuk melihat daftar model AI.`,
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    const startTime = Date.now();

    try {
      const response = await axios.post(
        AIHUBMIX_BASE_URL,
        {
          model: selectedModel,
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah asisten AI cerdas, cepat, dan ramah yang terintegrasi di WhatsApp Bot Kyros-MD. Jawablah pertanyaan dengan jelas, ringkas, akurat, dan gunakan format teks WhatsApp yang rapi (gunakan *bold* untuk poin penting).",
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          thinking: { type: enableThinking ? "enabled" : "disabled" },
          max_tokens: 2048,
          temperature: 0.7,
          stream: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AIHUBMIX_API_KEY}`,
          },
          timeout: 45000,
        }
      );

      const choice = response.data?.choices?.[0]?.message;
      let replyContent = choice?.content?.trim();

      if (!replyContent && choice?.reasoning_content) {
        replyContent = choice.reasoning_content.trim();
      }

      if (!replyContent) {
        throw new Error("Respon kosong dari penyedia AI.");
      }

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const modelDisplayName =
        POPULAR_FREE_MODELS[selectedModel]?.name || selectedModel;

      const finalMessage = `${replyContent}\n\n⚡ _${durationSec}s • ${modelDisplayName}_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: finalMessage,
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error("[AI Plugin Error]:", error?.response?.data || error?.message);
      const errorMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Gagal menghubungi server AI.";

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Gagal memproses permintaan AI (${selectedModel})*\n\n${errorMsg}`,
        },
        { quoted: msg }
      );
    }
  },
};
