import { COMPLETION_URL, FAKE_HEADERS, extractUserToken, generateFakeCookie, solvePow } from "./constants.js";
import { DeepSeekWebSession } from "./session.js";

export class DeepSeekWebWithAutoRefresh extends DeepSeekWebSession {
  async chat(prompt, { thinking = false, search = false, userToken = null } = {}) {
    const token = extractUserToken(
      userToken ||
        this.currentUserToken ||
        process.env.DEEPSEEK_COOKIE_TOKEN ||
        process.env.DEEPSEEK_TOKEN ||
        process.env.DEEPSEEK_USER_TOKEN
    );
    if (!token) {
      throw new Error(
        "DEEPSEEK_COOKIE_TOKEN belum diatur. Masukkan userToken dari chat.deepseek.com ke .env (DEEPSEEK_COOKIE_TOKEN)."
      );
    }
    this.setCurrentUserToken(token);

    const accessToken = await this.acquireAccessToken(token);
    const sessionId = await this.createSession(accessToken);

    try {
      const powChallenge = await this.getPowChallenge(accessToken);
      const powAnswer = solvePow(powChallenge);

      const reqHeaders = {
        ...FAKE_HEADERS,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Ds-Pow-Response": powAnswer,
        "X-Client-Timezone-Offset": String(new Date().getTimezoneOffset() * -60),
        Cookie: generateFakeCookie(),
      };

      const requestPayload = {
        chat_session_id: sessionId,
        parent_message_id: null,
        model_type: "deepseek_chat",
        prompt,
        ref_file_ids: [],
        thinking_enabled: Boolean(thinking),
        search_enabled: Boolean(search),
        preempt: false,
      };

      const resp = await fetch(COMPLETION_URL, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(requestPayload),
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          this.tokenCache.delete(token);
          throw new Error("Token DeepSeek kedaluwarsa saat request. Silakan perbarui userToken.");
        }
        if (resp.status === 429) {
          throw new Error("DeepSeek sedang terkena rate limit (terlalu banyak request). Coba beberapa saat lagi.");
        }
        throw new Error(`DeepSeek API error (HTTP ${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reasoningContent = "";
      let answerContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:") && !line.startsWith("data: ")) continue;
          const payload = line.replace(/^data:\s*/, "").trim();
          if (payload === "[DONE]") break;

          let data;
          try {
            data = JSON.parse(payload);
          } catch (_) {
            continue;
          }

          const v = data?.v;
          const p = data?.p;

          if (v && typeof v === "object" && v.response) {
            const fragments = v.response.fragments;
            if (Array.isArray(fragments)) {
              for (const frag of fragments) {
                if (frag?.type === "THINK") reasoningContent += frag.content || "";
                else if (frag?.type === "ANSWER" || frag?.type === "RESPONSE") answerContent += frag.content || "";
              }
            }
          }

          if (p === "response/fragments") {
            const fragments = Array.isArray(v) ? v : [v];
            for (const frag of fragments) {
              if (frag?.type === "THINK") reasoningContent += frag?.content || "";
              else if (frag?.type === "ANSWER" || frag?.type === "RESPONSE") answerContent += frag?.content || "";
            }
          }

          if (typeof v === "string") {
            answerContent += v;
          }
        }
      }

      return {
        answer: answerContent.trim(),
        reasoning: reasoningContent.trim() || null,
        thinkingEnabled: Boolean(thinking),
        source: "deepseek-web",
      };
    } finally {
      this.deleteSession(accessToken, sessionId).catch(() => {});
    }
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
