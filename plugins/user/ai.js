import axios from "axios";

const AIHUBMIX_BASE_URL = "https://aihubmix.com/v1/chat/completions";
const AIHUBMIX_API_KEY =
  process.env.AIHUBMIX_API_KEY ||
  "sk-CtXrMk37pKQe4JoP71A415F56e6a48279c6c3dC14cF3F341";
const MODEL_NAME = "coding-glm-4.6-free";

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
 * Mengirim request chat completions ke AIHubMix
 */
async function requestAi(userPrompt) {
  const response = await axios.post(
    AIHUBMIX_BASE_URL,
    {
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1024,
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

  const reply = response.data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Respon kosong dari penyedia AI.");
  }

  // Deteksi limit kuota AIHubMix
  if (
    reply.includes("accounts that have not been recharged can only try 10 times") ||
    reply.includes("prevent abuse of free resources")
  ) {
    throw new Error(
      "⚠️ Kuota free trial (10x) untuk API Key AIHubMix ini telah habis. Silakan perbarui `AIHUBMIX_API_KEY` di file `.env` atau top-up di https://console.aihubmix.com/topup."
    );
  }

  return reply;
}

export default {
  name: "ai",
  description: "Bertanya atau berinteraksi dengan AI (coding-glm-4.6-free via AIHubMix).",
  usage: "<pertanyaan/prompt>",
  example: "ai jelaskan kenapa azka suka sama jelita",
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
          text: `⚠️ *Format salah!*\n\nGunakan: \`${activePrefix}ai <pertanyaan>\`\nContoh: \`${activePrefix}ai jelaskan kenapa azka suka sama jelita\``,
        },
        { quoted: msg }
      );
    }

    try {
      const reply = await requestAi(userPrompt);

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
