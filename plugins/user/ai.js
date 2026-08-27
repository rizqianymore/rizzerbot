import axios from "axios";

const AIHUBMIX_BASE_URL = "https://aihubmix.com/v1/chat/completions";
const AIHUBMIX_API_KEY =
  process.env.AIHUBMIX_API_KEY ||
  "sk-CtXrMk37pKQe4JoP71A415F56e6a48279c6c3dC14cF3F341";
const DEFAULT_MODEL = "coding-glm-4.6-free";

/**
 * Mengambil teks dari pesan yang dikutip (jika ada).
 */
function getQuotedText(msg) {
  const quoted =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
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
 * Mengirim request chat completion ke AIHubMix
 */
async function getAiCompletion(userPrompt, options = {}) {
  const response = await axios.post(
    AIHUBMIX_BASE_URL,
    {
      model: options.model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah asisten AI cerdas, cepat, dan ramah yang terintegrasi di WhatsApp Bot Kyros-MD. Jawablah pertanyaan dengan jelas, akurat, informatif, dan gunakan format teks WhatsApp yang rapi (gunakan *bold* untuk poin penting).",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: options.max_tokens || 1024,
      stream: false,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AIHUBMIX_API_KEY}`,
      },
      timeout: options.timeout || 60000,
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Respon kosong dari AI provider.");
  }

  return reply;
}

export default {
  name: "ai",
  description: "Bertanya atau berinteraksi dengan kecerdasan buatan (GLM-4.6 via AIHubMix).",
  usage: "<pertanyaan/prompt>",
  example: "ai Apa perbedaan antara RAM dan ROM?",
  aliases: ["glm", "chatgpt", "ask", "botai"],
  category: "User",
  premiumOnly: false,
  ownerOnly: false,
  run: async (sock, msg, args, context) => {
    const { sendTyping, sendUsage, activePrefix } = context;

    await sendTyping();

    let userPrompt = args.join(" ").trim();
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
          text: `⚠️ *Format salah!*\n\nGunakan: \`${activePrefix}ai <pertanyaan>\`\nContoh: \`${activePrefix}ai Jelaskan teori relativitas secara singkat\``,
        },
        { quoted: msg }
      );
    }

    try {
      const reply = await getAiCompletion(userPrompt);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: reply,
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
          text: `❌ *Gagal memproses permintaan AI*\n\n${errorMsg}`,
        },
        { quoted: msg }
      );
    }
  },
};
