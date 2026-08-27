import axios from "axios";

const API_ENDPOINT = "https://free.empero.org/v1/chat/completions";
const API_KEY = "free";
const PRIMARY_MODEL = "glm-5.3-flash";
const FALLBACK_MODELS = ["qwen3.8-flash"];

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
 * Mengirim request chat completion dengan retry dan fallback model jika upstream error.
 */
async function requestAiCompletion(userPrompt, options = {}) {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await axios.post(
          API_ENDPOINT,
          {
            model,
            messages: [
              {
                role: "system",
                content:
                  "Kamu adalah asisten AI cerdas dan ramah yang terintegrasi di WhatsApp Bot Kyros-MD. Jawablah dengan jelas, ringkas, akurat, dan gunakan format teks WhatsApp yang rapi (gunakan *bold* untuk poin penting).",
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
            timeout: options.timeout || 35000,
          }
        );

        const content = response.data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          return { content, model };
        }
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errCode = err.response?.data?.error?.code;

        // Jika upstream down / 503, beri jeda singkat sebelum retry/fallback
        if (status === 503 || status === 502 || status === 429 || errCode === "upstream_down") {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        } else {
          // Jika error client (misal 400 Bad Request), hentikan retry
          break;
        }
      }
    }
  }

  throw lastError;
}

export default {
  name: "ai",
  description: "Bertanya atau berinteraksi dengan kecerdasan buatan (GLM-5.3-Flash / Qwen).",
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
      const result = await requestAiCompletion(userPrompt);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: result.content,
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error("[AI Plugin Error]:", error?.response?.data || error?.message);
      const isUpstreamDown =
        error?.response?.status === 503 ||
        error?.response?.data?.error?.code === "upstream_down" ||
        error?.message?.includes("503");

      const errorMessage = isUpstreamDown
        ? "⚠️ Server penyedia AI (`free.empero.org`) sedang restart/unreachable saat ini. Silakan coba kembali beberapa saat lagi."
        : error?.response?.data?.error?.message ||
          error?.message ||
          "Gagal menghubungi server AI.";

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Gagal memproses permintaan AI*\n\n${errorMessage}`,
        },
        { quoted: msg }
      );
    }
  },
};
