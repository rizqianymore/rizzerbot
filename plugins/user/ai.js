import axios from "axios";

const API_ENDPOINT = "https://free.empero.org/v1/chat/completions";
const API_KEY = "free";
const MODEL_NAME = "glm-5.3-flash";

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

export default {
  name: "ai",
  description: "Bertanya atau berinteraksi dengan kecerdasan buatan (GLM-5.3-Flash).",
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
      const response = await axios.post(
        API_ENDPOINT,
        {
          model: MODEL_NAME,
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah asisten AI cerdas dan ramah yang terintegrasi di WhatsApp Bot Kyros-MD. Jawablah pertanyaan dengan jelas, akurat, informatif, dan gunakan format teks WhatsApp yang rapi (gunakan *bold* untuk poin penting).",
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_tokens: 4096,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
          timeout: 60000,
        }
      );

      const aiReply =
        response.data?.choices?.[0]?.message?.content?.trim();

      if (!aiReply) {
        throw new Error("Respon kosong dari penyedia AI.");
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: aiReply,
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
