import crypto from "node:crypto";

const DEFAULT_CONFIG = {
  apiKey: "tryit-47804213578-1d4c4179c6e10f978b5399b40d0f9b2a",
  deviceId: "6i21E3GfZl4FxIqb31o0kqlGvfG_jUwK9FS7apVmECM",
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
};

/**
 * Tanya jawab AI via DeepAI Chat
 * @param {string} prompt Pertanyaan dari user
 * @param {object} [options] Konfigurasi tambahan
 * @param {string} [options.model="standard"] Model DeepAI (standard, genius, etc)
 * @param {string} [options.chatStyle="chat"] Style chat
 * @param {AbortSignal} [options.signal] AbortSignal timeout
 */
export async function askDeepAI(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Pertanyaan atau prompt tidak boleh kosong.");
  }

  const model = options.model || "standard";
  const chatStyle = options.chatStyle || "chat";
  const sessionUuid = options.sessionUuid || crypto.randomUUID();
  const sensitivityRequestId = crypto.randomUUID();

  const formData = new FormData();
  formData.append("chat_style", chatStyle);
  formData.append(
    "chatHistory",
    JSON.stringify([{ role: "user", content: prompt.trim() }])
  );
  formData.append("model", model);
  formData.append("session_uuid", sessionUuid);
  formData.append("sensitivity_request_id", sensitivityRequestId);
  formData.append("tool_activity_support", "1");
  formData.append("thinking_image_tool_support", "1");
  formData.append("hacker_is_stinky", "very_stinky");
  formData.append(
    "enabled_tools",
    JSON.stringify(["image_generator", "image_editor"])
  );

  const cookieStr = `deepai_device_id=${DEFAULT_CONFIG.deviceId}; deepai_privacy_prefs=%7B%22analytics%22%3Atrue%2C%22ads%22%3Atrue%2C%22audiences%22%3Atrue%2C%22third_party%22%3Atrue%2C%22training%22%3Atrue%2C%22marketing%22%3Atrue%7D;`;

  const response = await fetch("https://api.deepai.org/hacking_is_a_serious_crime", {
    method: "POST",
    headers: {
      "api-key": DEFAULT_CONFIG.apiKey,
      "user-agent": DEFAULT_CONFIG.userAgent,
      origin: "https://deepai.org",
      referer: "https://deepai.org/chat",
      cookie: cookieStr,
    },
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`DeepAI API error (HTTP ${response.status})`);
  }

  const answer = (await response.text()).trim();
  if (!answer) {
    throw new Error("Respon kosong dari server DeepAI.");
  }

  return {
    status: true,
    model,
    answer,
  };
}
