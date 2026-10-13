import axios from "axios";
import { extractUserToken } from "./constants.js";
import { DeepSeekWebWithAutoRefresh } from "./chat.js";

export const deepseekWebExecutor = new DeepSeekWebWithAutoRefresh();

export async function askDeepSeek(prompt, { thinking = false, search = false, userToken = null } = {}) {
  const token = extractUserToken(
    userToken || process.env.DEEPSEEK_COOKIE_TOKEN || process.env.DEEPSEEK_TOKEN || process.env.DEEPSEEK_USER_TOKEN
  );
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (token) {
    try {
      return await deepseekWebExecutor.chat(prompt, { thinking, search, userToken: token });
    } catch (err) {
      console.warn("[AI Gateway] DeepSeek Web failed, falling back:", err.message);
      if (!apiKey) throw err;
    }
  }

  if (apiKey) {
    try {
      const model = thinking ? "deepseek-reasoner" : "deepseek-chat";
      const { data } = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 45000,
        }
      );

      const choice = data?.choices?.[0]?.message;
      return {
        answer: choice?.content?.trim() || "Tidak ada jawaban.",
        reasoning: choice?.reasoning_content?.trim() || null,
        thinkingEnabled: Boolean(thinking),
        source: "deepseek-api",
      };
    } catch (err) {
      console.warn("[AI Gateway] DeepSeek API failed:", err.message);
      throw new Error(`DeepSeek API error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  try {
    const { data } = await axios.post(
      "https://text.pollinations.ai/openai",
      {
        model: "openai-fast",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 40000,
      }
    );

    const answer = data?.choices?.[0]?.message?.content || (typeof data === "string" ? data : "");
    if (!answer) throw new Error("Gagal menerima jawaban dari gateway publik.");

    return {
      answer: answer.trim(),
      reasoning: null,
      thinkingEnabled: false,
      source: "public-gateway",
      isFallback: true,
    };
  } catch (_err) {
    throw new Error(
      "DeepSeek belum dikonfigurasi. Masukkan DEEPSEEK_COOKIE_TOKEN di .env untuk menggunakan DeepSeek Web resmi."
    );
  }
}
